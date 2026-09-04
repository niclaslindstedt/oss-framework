// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clipboardBlob,
  clipboardCanBeRead,
  clipboardLookIsFree,
  clipboardText,
  readClipboard,
  readDataTransfer,
} from "../src/hooks/clipboardRead.ts";

/** A clipboard entry, the shape `navigator.clipboard.read()` hands over. */
function entry(parts: Record<string, string | Blob>) {
  return {
    types: Object.keys(parts),
    getType: async (type: string) => {
      const value = parts[type];
      if (value === undefined) throw new Error("no such type");
      return typeof value === "string"
        ? new Blob([value], { type })
        : (value as Blob);
    },
  };
}

function stubClipboard(clipboard: unknown, permissions?: unknown) {
  vi.stubGlobal("navigator", { clipboard, permissions });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("clipboardCanBeRead", () => {
  it("is true only where read() exists", () => {
    stubClipboard({ read: async () => [] });
    expect(clipboardCanBeRead()).toBe(true);
    stubClipboard({ readText: async () => "" });
    expect(clipboardCanBeRead()).toBe(false);
    stubClipboard(undefined);
    expect(clipboardCanBeRead()).toBe(false);
  });
});

describe("clipboardLookIsFree", () => {
  it("is free only on an already-granted permission", async () => {
    stubClipboard(
      { read: async () => [] },
      { query: async () => ({ state: "granted" }) },
    );
    await expect(clipboardLookIsFree()).resolves.toBe(true);
  });

  it("is not free while the permission would prompt", async () => {
    stubClipboard(
      { read: async () => [] },
      { query: async () => ({ state: "prompt" }) },
    );
    await expect(clipboardLookIsFree()).resolves.toBe(false);
  });

  it("is not free on a browser with no Permissions API", async () => {
    stubClipboard({ read: async () => [] }, undefined);
    await expect(clipboardLookIsFree()).resolves.toBe(false);
  });

  it("is not free when the query throws on the name", async () => {
    stubClipboard(
      { read: async () => [] },
      {
        query: async () => {
          throw new TypeError("unknown permission name");
        },
      },
    );
    await expect(clipboardLookIsFree()).resolves.toBe(false);
  });

  it("is not free where there is nothing to read", async () => {
    stubClipboard({}, { query: async () => ({ state: "granted" }) });
    await expect(clipboardLookIsFree()).resolves.toBe(false);
  });
});

describe("readClipboard", () => {
  it("hands back every flavour from one read", async () => {
    const read = vi.fn(async () => [
      entry({ "text/plain": "hello", "image/png": "PNGDATA" }),
    ]);
    stubClipboard({ read });
    const found = await readClipboard();
    expect(read).toHaveBeenCalledTimes(1);
    expect(found.map((f) => f.kind)).toEqual(["text", "blob"]);
    expect(clipboardText(found)).toBe("hello");
    expect(clipboardBlob(found)?.type).toBe("image/png");
  });

  it("takes only the types the caller accepts", async () => {
    stubClipboard({
      read: async () => [
        entry({ "text/plain": "hello", "application/pdf": "%PDF" }),
      ],
    });
    expect(await readClipboard()).toHaveLength(1);
    expect(
      await readClipboard({ accept: (t) => t === "application/pdf" }),
    ).toHaveLength(2);
  });

  it("falls back to readText where there is no read()", async () => {
    stubClipboard({ readText: async () => "just words" });
    expect(clipboardText(await readClipboard())).toBe("just words");
  });

  it("is empty for every way there is nothing", async () => {
    stubClipboard(undefined);
    expect(await readClipboard()).toEqual([]);

    stubClipboard({
      read: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
    });
    expect(await readClipboard()).toEqual([]);

    stubClipboard({
      readText: async () => {
        throw new Error("nope");
      },
    });
    expect(await readClipboard()).toEqual([]);

    stubClipboard({ read: async () => [] });
    expect(await readClipboard()).toEqual([]);
  });

  it("gives up on a read that never settles", async () => {
    vi.useFakeTimers();
    stubClipboard({ read: () => new Promise<never>(() => {}) });
    const pending = readClipboard({ timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(pending).resolves.toEqual([]);
  });

  it("skips an entry whose bytes will not come", async () => {
    stubClipboard({
      read: async () => [
        {
          types: ["image/png"],
          getType: async () => {
            throw new Error("gone");
          },
        },
      ],
    });
    expect(await readClipboard()).toEqual([]);
  });
});

describe("readDataTransfer", () => {
  const transfer = (text: string, files: File[] = []) =>
    ({
      getData: (type: string) => (type === "text/plain" ? text : ""),
      files,
    }) as unknown as DataTransfer;

  it("reads words and files with no permission at all", async () => {
    const png = new File(["x"], "shot.png", { type: "image/png" });
    const found = await readDataTransfer(transfer("hello", [png]));
    expect(clipboardText(found)).toBe("hello");
    expect(clipboardBlob(found)?.blob).toBe(png);
  });

  it("skips a file the caller does not accept", async () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(await readDataTransfer(transfer("", [pdf]))).toEqual([]);
  });

  it("is empty for no data at all", async () => {
    expect(await readDataTransfer(null)).toEqual([]);
    expect(await readDataTransfer(transfer(""))).toEqual([]);
  });
});

describe("clipboardText", () => {
  it("trims the newline a copied line brings with it", () => {
    expect(clipboardText([{ kind: "text", text: "one line\n" }])).toBe(
      "one line",
    );
  });

  it("is null for whitespace alone, and for no text", () => {
    expect(clipboardText([{ kind: "text", text: "  \n" }])).toBeNull();
    expect(clipboardText([])).toBeNull();
  });
});
