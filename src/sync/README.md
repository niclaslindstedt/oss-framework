<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `sync` — a status glyph and a command centre for a backed-up document

A local-first app that pushes its document to a backend (a cloud drive, a
picked folder, a remote server) needs one honest answer to "where is my data,
and is it safe right now?". This module is that answer, in two pieces:

- **`SyncStatus`** — a single header glyph that morphs with the save state: a
  green cloud-check when in sync, an accent cloud-upload when edits are waiting,
  a spinner mid-save, and a coloured cloud-alert for conflict / auth / throttle
  / error. Tapping it (in any state, never disabled) opens…
- **`SyncDetailsModal`** — the command centre: the headline status and _why_ a
  save failed, the actions to fix it (Save now / Reconnect / Reload / Check
  connection), the backend + at-rest-encryption + file-location grid, and an
  optional collapsible developer log.

```ts
import {
  SyncStatus,
  SyncDetailsModal,
  type SaveStatus,
  type ConnectionProbeResult,
  type SyncLocation,
} from "@niclaslindstedt/oss-framework/sync";
```

## What it owns vs. what stays in your app

This module is **purely presentational**. It owns how sync state _looks_ and
the inline action affordances; it owns none of the state machine. Your app's
**sync engine** owns the `SaveStatus`, the `dirty` / `offline` flags, and what
actually happens when the user taps Save now, Reconnect, Reload, or Check
connection. This is the same store seam every other module draws.

| In the framework                                             | In your app                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `SyncStatus` glyph + `SyncDetailsModal` layout               | the sync engine that produces `status` / `dirty` / `offline`                |
| the `SaveStatus` / `ConnectionProbeResult` contract          | the save queue, retries, conflict + auth + throttle handling                |
| the action _buttons_ (Save now / Reconnect / Reload / Check) | the `onSaveNow` / `onReconnect` / `onReload` / `onCheckConnection` handlers |
| the backend / encryption / location _grid_                   | the resolved `location` (path + web URL) and `encrypted` flag               |
| the collapsible "View sync log" chrome                       | whether to pass a `logPanel`, and what it contains                          |

The retry/backoff policy your engine drives the save loop with already lives in
the framework — see [`storage`](../storage/README.md)'s `backoffDelayMs` /
`isRetryableSaveError`. This module is the surface over that engine, not the
engine.

## The contract

`SaveStatus` is the union your engine reports:

```ts
type SaveStatus =
  | "idle" // nothing in flight; pair with `dirty` to tell clean from pending
  | "saving" // a write is in flight
  | "saved" // a write just landed
  | "error" // generic / transient failure
  | "conflict" // the backend holds a newer copy — needs resolution
  | "auth-error" // the session expired — needs a reconnect
  | "throttled"; // rate-limited; resumes on its own
```

`dirty` (local edits not yet pushed) and `offline` (backend unreachable) ride
**alongside** the status — they aren't states, because a document can be both
`saved` and `dirty`, or `idle` and `offline`. **`offline` always wins the
display**: a stale local copy must never read as "synced".

`ConnectionProbeResult` (`"online" | "offline" | "auth-error"`) is what an
active reachability probe returns, so the offline "Check connection" button can
report the outcome inline.

## Generic usage

Wire the glyph into your header and let it open the modal:

```tsx
const [detailsOpen, setDetailsOpen] = useState(false);
const sync = useMySyncEngine(); // your hook: { status, dirty, offline, ... }

<SyncStatus
  providerName={sync.providerName}
  status={sync.status}
  dirty={sync.dirty}
  offline={sync.offline}
  onOpenDetails={() => setDetailsOpen(true)}
/>;

<SyncDetailsModal
  open={detailsOpen}
  onClose={() => setDetailsOpen(false)}
  providerName={sync.providerName}
  backendKind={sync.backendKind} // "cloud" | "folder" — picks the grid glyph
  location={{ path: sync.path, url: sync.webUrl }}
  encrypted={sync.encrypted}
  status={sync.status}
  statusDetail={sync.lastError}
  dirty={sync.dirty}
  offline={sync.offline}
  onSaveNow={sync.saveNow}
  onReload={sync.reload}
  onReconnect={sync.reconnect} // or `null` for a backend with no reconnect
  onCheckConnection={sync.checkConnection}
/>;
```

Every action handler is **optional** — omit one and its affordance simply
doesn't render. A local-only app might pass none of them; a cloud app passes all
of them.

### The developer log slot

`SyncDetailsModal` has no built-in log — it exposes a `logPanel?: ReactNode`
slot and a collapsible "View sync log" section that wraps it. Gate it app-side
and pass the framework's own [`LogViewer`](../logging/README.md):

```tsx
logPanel={devMode ? <LogViewer store={logStore} /> : undefined}
```

When `logPanel` is omitted the whole section disappears. The framework doesn't
decide who sees the log — you do.

### Labels (i18n)

Every visible string is injectable. `SyncStatus` takes `labels?:
Partial<SyncStatusLabels>` and `SyncDetailsModal` takes `labels?:
Partial<SyncDetailsLabels>`; both default to English
(`DEFAULT_SYNC_STATUS_LABELS` / `DEFAULT_SYNC_DETAILS_LABELS`). Interpolated
strings are `(name: string) => string`:

```tsx
<SyncStatus
  labels={{ syncedTo: (name) => t("sync.syncedTo", { name }) }}
  /* … */
/>
```

## Adapting to your app

A new app's sync model won't match this surface exactly. The common mismatches:

- **You only have a local backend, no remote.** Pass `backendKind="folder"`
  (or `"cloud"`), a `location` with `url: null`, keep `offline` false, and omit
  `onReconnect` / `onCheckConnection`. The glyph reads "Synced to …" and the
  modal collapses to the status card + location. You still get a clean
  "where your data lives" affordance for free.
- **Your engine has fewer states.** `SaveStatus` is a superset. If you never
  throttle or conflict, you simply never report those values — the matching
  detail copy is never reached.
- **Your engine has an _extra_ state** the union doesn't cover (e.g. a
  "migrating" phase). Map it onto the nearest existing state for the glyph
  (`saving` for in-flight work) and surface the specifics through `statusDetail`
  / a custom `labels` entry — or propose widening `SaveStatus` upstream if it's
  a genuinely general state.
- **You compute the path/URL from a backend id + a namespace.** That mapping is
  app- and backend-coupled, so it stays in your app: resolve it to a
  `SyncLocation` (`{ path, url }`) and pass the result. The component never
  imports your storage layer.
- **Encryption is a wrapper, not a flag.** Pass `encrypted` as a plain boolean
  derived from whichever adapter your engine ended up with (e.g. "is the active
  adapter wrapped with [`withEncryption`](../encryption/README.md)?"). The grid
  shows On/Off from that boolean — it doesn't inspect the adapter.
- **Renamed tones / colours.** The tone classes key off the framework theme's
  tokens (`success`, `pipe`, `flag`, `danger`, `accent`). If your app renames
  those CSS variables, remap them in your theme layer; the component asks only
  that the tokens exist (see [`theme`](../theme/README.md)).

## Verification

After wiring, confirm:

- The header glyph shows green/synced when clean, flips to the accent
  cloud-upload the instant you make an edit, and spins while a save is in
  flight.
- Tapping the glyph in **any** state opens the modal (it's never disabled).
- Forcing `offline` makes the glyph read "Offline" regardless of `dirty`, and
  the modal shows the "Check connection" button that reports the probe result.
- Forcing `auth-error` surfaces the Reconnect button; a rejected `onReconnect`
  shows the error inline and flips the label to "Try again".
- Omitting an action handler hides exactly that affordance and nothing else.
