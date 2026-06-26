// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// An in-app log store: a bounded, in-memory ring buffer of structured log
// entries with an optional, debounced localStorage mirror and a pub/sub layer
// so an in-app "Logs" surface can render the buffer live.
//
// Why a library wants this. A local-first PWA runs in a browser tab where the
// user often can't reach devtools (notably on mobile), so the diagnostics that
// would normally go to the console (which sync ran, how long it took, how it
// ended) have nowhere to land. This store is the sink: every `createLogger`
// call pushes into the same ring buffer, an in-app Logs panel reads it back,
// and a "capture" toggle mirrors it to localStorage so a reload preserves the
// history a bug report needs. It deliberately writes to NO console.
//
// The store is a self-contained factory — call `createLogStore` with your own
// persistence keys and the React/UI layer that renders it stays your app's.
// The loggers it hands out satisfy the `Logger` sink the storage adapters take,
// so the same buffer captures sync diagnostics end to end.
//
//   const store = createLogStore({ logsKey: "myapp:logs", captureKey: "myapp:capture" });
//   const log = store.createLogger("dropbox");
//   log.info("load start");
//   log.warn("token expiring");
//   log.error("save failed", err);
//   await log.time("load", () => fetch(...));

/** Severity of a log entry. */
export type LogLevel = "info" | "warn" | "error";

/** One captured line: a timestamp, level, scope tag, and rendered message. */
export type LogEntry = {
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
};

/**
 * A scoped logger. `info`/`warn`/`error` are the injectable sink the storage
 * adapters call (structurally a superset of the storage `Logger`); `time`
 * brackets an async op with a start line and an ok/failed line carrying the
 * elapsed milliseconds, re-throwing on rejection.
 */
export type ScopedLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  time: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

/** Knobs for a store; every field has a sensible default. */
export type LogStoreOptions = {
  /** localStorage key for the persisted (captured) buffer. */
  logsKey?: string;
  /** localStorage key for the capture-on flag. */
  captureKey?: string;
  /** Ring-buffer cap; older entries are dropped past it. Default 500. */
  maxEntries?: number;
  /** Debounce before mirroring the buffer to localStorage. Default 250ms. */
  saveDebounceMs?: number;
  /**
   * Initial state of the activity gate (see `setEnabled`). Default `true`:
   * the store records every call. Pass `false` to start dormant — useful for a
   * developer-only diagnostic that an app activates once a dev-mode flag flips.
   */
  enabled?: boolean;
};

/** The public surface of a log store. */
export type LogStore = {
  /** A logger tagged with `scope`; every call pushes into this store. */
  createLogger: (scope: string) => ScopedLogger;
  /** A snapshot copy of the current buffer (oldest first). */
  getLogs: () => LogEntry[];
  /** Empty the buffer and drop the persisted mirror. */
  clearLogs: () => void;
  /** Subscribe to buffer changes (push / clear / capture flip); returns an unsubscribe. */
  subscribeToLogs: (cb: () => void) => () => void;
  /** Turn the localStorage mirror on or off (persisted per device). */
  setCaptureEnabled: (enabled: boolean) => void;
  /** Whether the localStorage mirror is on. */
  isCaptureEnabled: () => boolean;
  /**
   * Flip the activity gate. When off, a push records only if capture is on;
   * when on, every push records. This is the seam an app uses to gate logging
   * behind a developer-mode flag without the store knowing what that flag is.
   */
  setEnabled: (enabled: boolean) => void;
  /** Current state of the activity gate. */
  isEnabled: () => boolean;
};

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_SAVE_DEBOUNCE_MS = 250;
const DEFAULT_LOGS_KEY = "oss-framework:logs";
const DEFAULT_CAPTURE_KEY = "oss-framework:capture-logs";

function safeReadLocal(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocal(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // Quota or access errors shouldn't break the app; this is a best-effort sink.
  }
}

function safeRemoveLocal(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // Same as above.
  }
}

function isLogEntry(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.ts === "number" &&
    (e.level === "info" || e.level === "warn" || e.level === "error") &&
    typeof e.scope === "string" &&
    typeof e.message === "string"
  );
}

// Render an Error for the log buffer. Leads with `name: message` and appends
// the stack when available — Safari / iOS Safari format `err.stack` as bare
// frames (no leading `Error: <message>` line), so naively falling back to
// `err.stack` swallows the message and leaves only a file:line location.
function describeError(err: Error): string {
  const head = err.message ? `${err.name}: ${err.message}` : err.name;
  if (!err.stack) return head;
  return err.stack.startsWith(err.name) ? err.stack : `${head}\n${err.stack}`;
}

// Serializer for log payloads. Handles Errors (full stack + message), cycles,
// bigints, and functions — anything JSON can't round-trip on its own.
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const out = JSON.stringify(value, (_key, v: unknown) => {
      if (v instanceof Error) return describeError(v);
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "function") {
        return `[function ${(v as { name?: string }).name || "anonymous"}]`;
      }
      if (typeof v === "undefined") return "undefined";
      return v;
    });
    return out ?? "undefined";
  } catch {
    return String(value);
  }
}

function formatMessage(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return describeError(a);
      return safeStringify(a);
    })
    .join(" ");
}

/**
 * Create an isolated log store. Each store owns its own buffer, capture flag,
 * persistence keys, and subscribers — call once at module scope with your app's
 * keys and share the returned object.
 */
export function createLogStore(options: LogStoreOptions = {}): LogStore {
  const logsKey = options.logsKey ?? DEFAULT_LOGS_KEY;
  const captureKey = options.captureKey ?? DEFAULT_CAPTURE_KEY;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const saveDebounceMs = options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS;

  // In-memory ring buffer. Written to whenever logging is active — the cost is
  // one push + a possible shift, bounded at `maxEntries`. The localStorage
  // mirror is the part gated by the capture flag specifically.
  const buffer: LogEntry[] = [];
  const subscribers = new Set<() => void>();
  let captureEnabled = safeReadLocal(captureKey) === "true";
  // The activity gate. Capture being on always implies recording too, but we
  // track both so the predicate reads plainly.
  let enabled = options.enabled ?? true;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Logging records when the gate is on or capture is on. With both off there's
  // typically no surface that can show the buffer, so a push is a no-op.
  function loggingActive(): boolean {
    return enabled || captureEnabled;
  }

  function scheduleSave(): void {
    if (!captureEnabled) return;
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushToStorage();
    }, saveDebounceMs);
  }

  function flushToStorage(): void {
    if (!captureEnabled) return;
    safeWriteLocal(logsKey, JSON.stringify(buffer));
  }

  function notify(): void {
    for (const cb of subscribers) {
      try {
        cb();
      } catch {
        // Subscriber errors must not break the logger.
      }
    }
  }

  function push(level: LogLevel, scope: string, args: unknown[]): void {
    if (!loggingActive()) return;
    buffer.push({ ts: Date.now(), level, scope, message: formatMessage(args) });
    if (buffer.length > maxEntries) {
      buffer.splice(0, buffer.length - maxEntries);
    }
    scheduleSave();
    notify();
  }

  function createLogger(scope: string): ScopedLogger {
    return {
      info(...args) {
        push("info", scope, args);
      },
      warn(...args) {
        push("warn", scope, args);
      },
      error(...args) {
        push("error", scope, args);
      },
      async time(label, fn) {
        const start = performance.now();
        push("info", scope, [`${label} …`]);
        try {
          const result = await fn();
          const ms = (performance.now() - start).toFixed(0);
          push("info", scope, [`${label} ok (${ms}ms)`]);
          return result;
        } catch (err) {
          const ms = (performance.now() - start).toFixed(0);
          push("error", scope, [`${label} failed (${ms}ms)`, err]);
          throw err;
        }
      },
    };
  }

  function setCaptureEnabled(next: boolean): void {
    if (captureEnabled === next) return;
    captureEnabled = next;
    if (next) {
      safeWriteLocal(captureKey, "true");
      // Persist whatever's currently in the buffer so re-enabling restores the
      // recent ring-buffer history.
      flushToStorage();
    } else {
      safeRemoveLocal(captureKey);
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      // Leave the persisted buffer in place. Re-enabling capture restores the
      // previous list; use clearLogs() to wipe explicitly.
    }
    notify();
  }

  function setEnabled(next: boolean): void {
    enabled = next;
  }

  function clearLogs(): void {
    buffer.length = 0;
    safeRemoveLocal(logsKey);
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    notify();
  }

  // Rehydrate the ring buffer from localStorage once, at construction.
  // Best-effort — a corrupt entry is dropped rather than failing the whole load.
  (function rehydrate(): void {
    const raw = safeReadLocal(logsKey);
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      if (isLogEntry(item)) buffer.push(item);
    }
    if (buffer.length > maxEntries) {
      buffer.splice(0, buffer.length - maxEntries);
    }
  })();

  return {
    createLogger,
    getLogs: () => buffer.slice(),
    clearLogs,
    subscribeToLogs(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    setCaptureEnabled,
    isCaptureEnabled: () => captureEnabled,
    setEnabled,
    isEnabled: () => enabled,
  };
}

/**
 * A ready-to-use store on the framework's default keys
 * (`oss-framework:logs` / `oss-framework:capture-logs`). Apps that want their
 * own persistence keys (or more than one store) call `createLogStore` instead.
 */
export const defaultLogStore: LogStore = createLogStore();
