<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `logging` — in-app log buffer

```ts
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";
```

A bounded, in-memory **log ring buffer** with an optional `localStorage`
mirror and a pub/sub layer, for local-first PWAs that can't rely on the
devtools console — a browser tab on a phone has no console the user can reach,
so the diagnostics that would normally print there (which sync ran, how long it
took, how it ended) need somewhere in-app to land. This module is that sink.

## What it owns vs. what stays in your app

- **The framework owns** the buffer, its size cap, the capture-to-`localStorage`
  mirror (debounced, rehydrated on load), the subscriber fan-out, and the
  scoped-logger factory. It writes to **no console** by design.
- **Your app owns** the UI that renders the buffer (the Logs panel, filters,
  Copy/Clear buttons) and the React store behind any developer-mode toggle that
  decides _when_ logging is active. The store exposes `setEnabled` as the seam
  that toggle drives — the framework never learns what your flag is or where it
  lives.

The loggers `createLogger` returns satisfy the `Logger` sink the
[`storage`](../storage/README.md) adapters accept, so the same buffer captures
your sync diagnostics end to end: pass `store.createLogger("dropbox")` as a
backend's `logger` option.

## The contract

- **Persistence keys are yours.** `createLogStore` takes `logsKey` /
  `captureKey`; pick app-namespaced strings (e.g. `"myapp:logs"`). They default
  to `"oss-framework:logs"` / `"oss-framework:capture-logs"`.
- **`localStorage` is optional.** Every access is wrapped — a missing
  `localStorage` (SSR) or a quota error degrades to in-memory only, never throws.
- **The buffer is bounded** at `maxEntries` (default 500); the oldest entries
  are dropped past it.
- **A `LogEntry` is `{ ts, level, scope, message }`** — `message` is already a
  rendered string (Errors carry name + stack, cycles become `[Circular]`).

## API

| Export                     | What it is                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `createLogStore(options?)` | Build an isolated store on your keys. Returns a `LogStore`.                        |
| `defaultLogStore`          | A ready store on the framework's default keys (simple apps / demos).               |
| `LogStore`                 | `createLogger`, `getLogs`, `clearLogs`, `subscribeToLogs`, capture + gate setters. |
| `ScopedLogger`             | What `createLogger(scope)` returns: `info`/`warn`/`error`/`time`.                  |
| `LogEntry`, `LogLevel`     | The captured-line shape and its severities.                                        |
| `LogStoreOptions`          | `logsKey`, `captureKey`, `maxEntries`, `saveDebounceMs`, `enabled`.                |
| `formatLogTime(ts)`        | `HH:MM:SS` for a panel's per-entry timestamp.                                      |
| `formatLogLine(entry)`     | `HH:MM:SS [scope] LEVEL message` — one plain line for "Copy logs".                 |
| `useLogs(store)`           | Subscribe a component to a store's buffer with a cached, stable snapshot.          |
| `LogViewer`                | A ready Logs panel over a store: level filter, copy, clear, coloured entries.      |
| `LogModal`                 | A modal showing one **operation's** step log — passed entries, opened on demand.   |
| `LogModalEntry`            | A modal line: `{ ts, level, text }` — `text` is your already-rendered string.      |

`useLogs` is the React binding for the buffer: `store.getLogs()` returns a fresh
array each call, which `useSyncExternalStore` cannot consume directly (a new
reference every render reads as a perpetual change and loops). `useLogs` caches
the snapshot and refreshes it only when the store notifies. `LogViewer` is the
batteries-included panel built on it — pass it a `store` (every visible string
injects via `labels`, English by default); its level → colour mapping rides the
theme's `meta`/`flag`/`negative` slots (info/warn/error) and `link` (the scope).
Keep rendering your own panel from `useLogs` + `formatLogLine` if you need a
different layout.

### `LogModal` — one operation's trace

`LogViewer` renders the **whole** buffer, live, with filters. `LogModal` is its
focused counterpart: a modal showing the step-by-step log of a **single**
operation — the sequence of lines one async, multi-step job emitted while it
ran. Open it on demand, typically from a status line that went red, so the user
can read exactly what that one operation did and what stopped it without
scrolling the global Logs panel.

It owns no state. Collect the operation's entries as it runs — each a
`LogModalEntry` (`{ ts, level, text }`, where `text` is the string you'd show
the user, already translated if your app has i18n) — and pass them in with an
`open` / `onClose` control:

```tsx
import {
  LogModal,
  type LogModalEntry,
} from "@niclaslindstedt/oss-framework/logging";
import { ShieldIcon } from "@niclaslindstedt/oss-framework/components";

const [log, setLog] = useState<LogModalEntry[]>([]);
const [open, setOpen] = useState(false);

// while the operation runs, push lines:
setLog((l) => [...l, { ts: Date.now(), level: "warn", text: "retrying…" }]);

<LogModal
  open={open}
  entries={log}
  onClose={() => setOpen(false)}
  icon={<ShieldIcon className="h-4 w-4" />} // optional — theme it to the op
  labels={{ title: "Encryption log", close: "Close" }}
/>;
```

Unlike a `LogEntry`, a `LogModalEntry` carries **no `scope`** — the modal is
already scoped to one operation, so `text` is the whole line. To feed it from a
`LogStore` instead (e.g. show the last sync's lines), map the slice you want:
`store.getLogs().filter(byThisOp).map((e) => ({ ts: e.ts, level: e.level, text: e.message }))`.
The header glyph is a prop (defaults to a neutral scroll icon) and every visible
string injects via `labels`, so the modal carries no i18n. Its level → colour
mapping rides the theme's `accent`/`flag`/`danger` rails (info/warn/error),
following the active theme.

`ScopedLogger.time(label, fn)` brackets an async op: it logs `label …`, runs
`fn`, then logs `label ok (<ms>ms)` — or `label failed (<ms>ms)` at error level
before re-throwing.

The activity gate: a push records when **the gate is on _or_ capture is on**.
`enabled` starts `true` (record everything). Pass `enabled: false` and call
`setEnabled(true)` later to keep the store dormant until a developer-mode flag
flips — capture-on still forces recording so a captured session is never lost.

## Quick start

```ts
// log-store.ts — one module-scope store, shared app-wide.
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";

export const logStore = createLogStore({
  logsKey: "myapp:logs",
  captureKey: "myapp:capture-logs",
});

// wherever you create a storage backend:
const adapter = createDropboxAdapter({
  /* … */ logger: logStore.createLogger("dropbox"),
});
```

```tsx
// LogsPanel.tsx — a live view, owned by your app.
import { useEffect, useState } from "react";
import { formatLogLine } from "@niclaslindstedt/oss-framework/logging";
import { logStore } from "./log-store.ts";

export function LogsPanel() {
  const [, tick] = useState(0);
  useEffect(() => logStore.subscribeToLogs(() => tick((v) => v + 1)), []);
  const entries = logStore.getLogs();
  return <pre>{entries.map(formatLogLine).join("\n")}</pre>;
}
```

## Migrating an existing in-app logger onto it

If your app already has a module-scope logger with a ring buffer + capture flag
(the common shape), the move is mechanical:

1. Replace the buffer/capture/persistence internals with a single
   `createLogStore({ logsKey, captureKey })` on **your existing keys** — so a
   user's captured history survives the upgrade.
2. Swap bare `import { createLogger, getLogs, … }` for methods on the store
   (`logStore.createLogger`, `logStore.getLogs`, …). Keep your Logs panel and
   any `useDevMode`-style hook exactly as they are — they call the same names.
3. Delete your local `formatLogTime` / `formatLogLine` and import them instead.

**Gating logging behind developer mode.** If your logger only recorded while a
dev-mode flag (or "capture") was on, construct with `enabled: false` seeded from
your persisted flag and forward the flag through `setEnabled`:

```ts
export const logStore = createLogStore({
  logsKey,
  captureKey,
  enabled: readDevModeFlag(), // your own key, read at startup
});
// in the hook that owns the flag:
function setDevMode(on: boolean) {
  /* persist … */ logStore.setEnabled(on);
}
```

If your logger recorded **unconditionally**, drop both — the default `enabled:
true` is exactly that behaviour.

## Partial match — reconciling differences

- **Your logger had no capture/persistence** (in-memory only): leave
  `captureKey` at its default and never call `setCaptureEnabled`; the mirror
  stays dormant and nothing is written to `localStorage`.
- **Your logger had no `time()`**: ignore it — it's additive; `info`/`warn`/
  `error` are unchanged.
- **Your scopes/level set differ**: `scope` is a free string and `level` is
  `"info" | "warn" | "error"`. If you logged a `"debug"` level, fold it into
  `info`; if you keyed UI off extra scopes, they pass through untouched.
- **You want more than one buffer** (e.g. a separate audit log): call
  `createLogStore` again with different keys — stores are fully isolated.
- **You persisted under different keys per environment**: compute `logsKey` /
  `captureKey` from your base path before constructing, as you would any
  per-origin namespacing.
- **SSR / non-browser**: safe — every `localStorage` access is guarded; the
  store runs in-memory when storage is absent.

## Verification

After wiring, confirm in the app: trigger a sync (or any logged op) and check
the entries appear in your Logs panel live; toggle capture on, reload, and
confirm the history is restored; toggle capture off and confirm new entries
stop reaching `localStorage` (the in-memory panel still updates). `make test`
covers the buffer, the gate, capture/rehydrate, and `time()`.
