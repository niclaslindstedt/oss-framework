// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  RateLimitError,
  TransientHttpError,
  isTransientTransferError,
  mapLimit,
  withTransientRetries,
} from "../src/storage/index.ts";

// Nothing in these tests should spend real seconds asleep.
const nowait = () => Promise.resolve();

describe("isTransientTransferError", () => {
  it("retries a throttle, a 5xx, and a fetch that never left", () => {
    expect(isTransientTransferError(new RateLimitError(1000))).toBe(true);
    expect(isTransientTransferError(new TransientHttpError(503, "down"))).toBe(
      true,
    );
    expect(isTransientTransferError(new TypeError("Load failed"))).toBe(true);
    expect(isTransientTransferError(new TypeError("Failed to fetch"))).toBe(
      true,
    );
  });

  it("reports a real failure as-is", () => {
    expect(isTransientTransferError(new Error("404 not found"))).toBe(false);
    // A genuine programming TypeError must not be retried five times before
    // it surfaces.
    expect(isTransientTransferError(new TypeError("x is not a function"))).toBe(
      false,
    );
  });
});

describe("withTransientRetries", () => {
  it("returns the first success without waiting", async () => {
    const wait = vi.fn(nowait);
    const op = vi.fn(async () => "bytes");
    expect(await withTransientRetries("read", op, { wait })).toBe("bytes");
    expect(wait).not.toHaveBeenCalled();
  });

  it("retries through a transient failure and then succeeds", async () => {
    let calls = 0;
    const op = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new TransientHttpError(503, "down");
      return "bytes";
    });
    expect(await withTransientRetries("read", op, { wait: nowait })).toBe(
      "bytes",
    );
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("waits exactly as long as a throttle asked, clamped", async () => {
    const waited: number[] = [];
    const wait = async (ms: number) => {
      waited.push(ms);
    };
    let calls = 0;
    await withTransientRetries(
      "read",
      async () => {
        calls += 1;
        if (calls === 1) throw new RateLimitError(2500);
        if (calls === 2) throw new RateLimitError(600_000);
        return "bytes";
      },
      { wait, maxWaitMs: 30_000 },
    );
    expect(waited).toEqual([2500, 30_000]);
  });

  it("gives up after the attempt budget and rethrows the last failure", async () => {
    const op = vi.fn(async () => {
      throw new TransientHttpError(500, "still down");
    });
    await expect(
      withTransientRetries("read", op, { attempts: 3, wait: nowait }),
    ).rejects.toThrow("still down");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("does not retry a failure that is not transient", async () => {
    const op = vi.fn(async () => {
      throw new Error("no such file");
    });
    await expect(
      withTransientRetries("read", op, { wait: nowait }),
    ).rejects.toThrow("no such file");
    expect(op).toHaveBeenCalledOnce();
  });

  it("logs each retry with the attempt it is on", async () => {
    const warn = vi.fn();
    let calls = 0;
    await withTransientRetries(
      "read photo.jpg",
      async () => {
        calls += 1;
        if (calls === 1) throw new RateLimitError(100);
        return "bytes";
      },
      {
        attempts: 4,
        wait: nowait,
        log: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
      },
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain("read photo.jpg");
    expect(warn.mock.calls[0]![0]).toContain("attempt 2/4");
  });
});

describe("mapLimit", () => {
  it("keeps results in input order", async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("never runs more than `limit` at once", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapLimit(
      Array.from({ length: 12 }, (_, i) => i),
      4,
      async (n) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return n;
      },
    );
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("handles an empty list without spawning a worker", async () => {
    const fn = vi.fn(async (n: number) => n);
    expect(await mapLimit([], 4, fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
