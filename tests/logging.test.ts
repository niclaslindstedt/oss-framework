// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLogStore,
  formatLogLine,
  formatLogTime,
  type LogEntry,
  type ScopedLogger,
} from "../src/logging/index.ts";
import type { Logger } from "../src/storage/index.ts";

// Each test builds a fresh store on its own keys so the jsdom localStorage
// (shared across the file) never leaks between cases.
let n = 0;
function freshStore(opts: Parameters<typeof createLogStore>[0] = {}) {
  n += 1;
  return createLogStore({
    logsKey: `test:logs:${n}`,
    captureKey: `test:capture:${n}`,
    ...opts,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("createLogStore", () => {
  it("records into the buffer and reads it back oldest-first", () => {
    const store = freshStore();
    const log = store.createLogger("dropbox");
    log.info("load start");
    log.warn("token expiring");
    log.error("save failed");

    const entries = store.getLogs();
    expect(entries.map((e) => [e.scope, e.level, e.message])).toEqual([
      ["dropbox", "info", "load start"],
      ["dropbox", "warn", "token expiring"],
      ["dropbox", "error", "save failed"],
    ]);
  });

  it("getLogs returns a copy, not the live buffer", () => {
    const store = freshStore();
    store.createLogger("s").info("a");
    const snapshot = store.getLogs();
    snapshot.push({ ts: 0, level: "info", scope: "x", message: "y" });
    expect(store.getLogs()).toHaveLength(1);
  });

  it("joins multiple args and serializes non-strings", () => {
    const store = freshStore();
    store.createLogger("s").info("status", 200, { ok: true });
    expect(store.getLogs()[0]?.message).toBe('status 200 {"ok":true}');
  });

  it("renders Errors with name and message, and handles cycles", () => {
    const store = freshStore();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    store.createLogger("s").error("boom", new Error("nope"), cyclic);
    const message = store.getLogs()[0]?.message ?? "";
    expect(message).toContain("Error: nope");
    expect(message).toContain("[Circular]");
  });

  it("caps the buffer at maxEntries, dropping the oldest", () => {
    const store = freshStore({ maxEntries: 3 });
    const log = store.createLogger("s");
    for (let i = 0; i < 5; i += 1) log.info(`m${i}`);
    expect(store.getLogs().map((e) => e.message)).toEqual(["m2", "m3", "m4"]);
  });

  it("notifies subscribers on push and clear, and stops after unsubscribe", () => {
    const store = freshStore();
    const cb = vi.fn();
    const off = store.subscribeToLogs(cb);
    store.createLogger("s").info("a");
    store.clearLogs();
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    store.createLogger("s").info("b");
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("clearLogs empties the buffer and the persisted mirror", () => {
    const store = freshStore();
    store.setCaptureEnabled(true);
    store.createLogger("s").info("a");
    store.clearLogs();
    expect(store.getLogs()).toHaveLength(0);
    expect(localStorage.getItem(`test:logs:${n}`)).toBeNull();
  });
});

describe("the activity gate", () => {
  it("records by default (enabled is true)", () => {
    const store = freshStore();
    store.createLogger("s").info("a");
    expect(store.getLogs()).toHaveLength(1);
  });

  it("drops pushes while disabled", () => {
    const store = freshStore({ enabled: false });
    store.createLogger("s").info("a");
    expect(store.getLogs()).toHaveLength(0);
    store.setEnabled(true);
    store.createLogger("s").info("b");
    expect(store.getLogs().map((e) => e.message)).toEqual(["b"]);
  });

  it("still records while disabled if capture is on", () => {
    const store = freshStore({ enabled: false });
    store.setCaptureEnabled(true);
    store.createLogger("s").info("a");
    expect(store.getLogs()).toHaveLength(1);
  });
});

describe("capture + persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes the existing buffer synchronously when capture is turned on", () => {
    const store = freshStore();
    store.createLogger("s").info("a");
    store.setCaptureEnabled(true);
    expect(localStorage.getItem(`test:capture:${n}`)).toBe("true");
    expect(localStorage.getItem(`test:logs:${n}`)).toContain('"a"');
  });

  it("mirrors later pushes after the debounce window", () => {
    const store = freshStore();
    store.setCaptureEnabled(true);
    store.createLogger("s").info("a");
    // Debounced — not written yet.
    expect(localStorage.getItem(`test:logs:${n}`)).toBe("[]");
    vi.advanceTimersByTime(250);
    expect(localStorage.getItem(`test:logs:${n}`)).toContain('"a"');
  });

  it("does not mirror to localStorage when capture is off", () => {
    const store = freshStore();
    store.createLogger("s").info("a");
    vi.advanceTimersByTime(250);
    expect(localStorage.getItem(`test:logs:${n}`)).toBeNull();
  });

  it("rehydrates the buffer from a previous captured session", () => {
    const first = freshStore();
    const keys = { logsKey: `test:logs:${n}`, captureKey: `test:capture:${n}` };
    first.createLogger("s").info("survives reload");
    first.setCaptureEnabled(true);
    // A second store on the same keys (a "reload") sees the persisted entries.
    const second = createLogStore(keys);
    expect(second.getLogs().map((e) => e.message)).toEqual(["survives reload"]);
  });

  it("turning capture off keeps the persisted history for a later re-enable", () => {
    const store = freshStore();
    store.createLogger("s").info("a");
    store.setCaptureEnabled(true);
    store.setCaptureEnabled(false);
    expect(localStorage.getItem(`test:capture:${n}`)).toBeNull();
    expect(localStorage.getItem(`test:logs:${n}`)).toContain('"a"');
  });
});

describe("ScopedLogger.time", () => {
  it("brackets a success with start + ok lines and returns the value", async () => {
    const store = freshStore();
    const log = store.createLogger("s");
    const value = await log.time("load", async () => 42);
    expect(value).toBe(42);
    const messages = store.getLogs().map((e) => e.message);
    expect(messages[0]).toBe("load …");
    expect(messages[1]).toMatch(/^load ok \(\d+ms\)$/);
  });

  it("logs a failure and re-throws", async () => {
    const store = freshStore();
    const log = store.createLogger("s");
    await expect(
      log.time("load", async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
    const entries = store.getLogs();
    expect(entries[1]?.level).toBe("error");
    expect(entries[1]?.message).toMatch(/^load failed \(\d+ms\) Error: nope/);
  });
});

describe("format helpers", () => {
  it("formatLogTime pads to HH:MM:SS", () => {
    const ts = new Date(2026, 0, 2, 3, 4, 5).getTime();
    expect(formatLogTime(ts)).toBe("03:04:05");
  });

  it("formatLogLine renders one plain-text line", () => {
    const entry: LogEntry = {
      ts: new Date(2026, 0, 2, 3, 4, 5).getTime(),
      level: "warn",
      scope: "dropbox",
      message: "token expiring",
    };
    expect(formatLogLine(entry)).toBe("03:04:05 [dropbox] WARN token expiring");
  });
});

describe("sink compatibility", () => {
  it("a ScopedLogger satisfies the storage Logger sink", () => {
    const store = freshStore();
    // Compile-time assignability: a scoped logger is a valid storage sink.
    const sink: Logger = store.createLogger("storage");
    sink.info("wired");
    expect(store.getLogs()[0]?.message).toBe("wired");
    // Belt-and-braces: the structural shape holds at runtime too.
    const scoped: ScopedLogger = store.createLogger("x");
    expect(typeof scoped.time).toBe("function");
  });
});
