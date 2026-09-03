<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/storage`

The shared persistence layer for local-first PWAs: one `StorageAdapter`
contract and four backends — the browser's `localStorage`, a user-picked local
folder, Dropbox, and Google Drive — behind a single interface, so an app can
offer "where do my documents live?" as a setting without the rest of it caring
which backend is active.

```ts
import {
  BrowserLocalStorageAdapter,
  createFolderAdapter,
  createDropboxAdapter,
  createGdriveAdapter,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
```

## The core idea: adapters speak bytes

A `StorageAdapter` moves **text**, not your data model. `save(text)` takes the
serialized document and `load()` returns it unchanged. Whatever
serialize / parse / migrate pipeline turns your model into that text stays in
your app, above this seam — which is exactly what lets the framework own the
backends without knowing anything about notes, checklists, or whatever you
store.

```ts
type StorageAdapter = {
  id: "browser" | "folder" | "dropbox" | "gdrive";
  label: string;
  capabilities: ReadonlySet<AdapterCapability>;
  load(): Promise<StoredSnapshot | null>;
  save(text: string, baseRevision?: string): Promise<StoredSnapshot>;
  loadSync?(): StoredSnapshot | null;
  getRevision?(): Promise<string | null>;
  probe?(): Promise<boolean>;
  watch?(onRemoteChange: (s: StoredSnapshot) => void): () => void;
};
```

A `StoredSnapshot` is `{ text, revision?, offline? }`. `revision` is an opaque
optimistic-concurrency token (Dropbox `rev`, a Drive version, a file mtime):
hand it back on the next `save` and the adapter throws `ConflictError` —
carrying the newer remote bytes — rather than clobbering a change another device
made. Backends advertise optional features through `capabilities` so the UI
gates on `capabilities.has("probe")` rather than `Boolean(adapter.probe)`.

Three typed errors let a caller react instead of showing a generic failure:
`ConflictError` (the remote moved), `AuthError` (reconnect needed), and
`RateLimitError` (back off `retryAfterMs`).

## What the framework owns vs. what stays in your app

| Owned here (shared)                                                  | Stays in your app                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The `StorageAdapter` / `FileStore` contracts and the typed errors    | Serialize / parse — turning your model into `text` and back           |
| `createMigrator` — the forward-only document-migration **engine**    | The migration **chain** + latest version (your data model's shape)    |
| The four backends + their OAuth, offline-cache, and HTTP plumbing    | Where the user's backend choice and tokens are persisted              |
| `createFileStoreAdapter` — the single-file binding for file backends | A richer on-disk layout (one file per item), built on the `FileStore` |
| Encryption is **not** here — it's a separate concern                 | At-rest encryption (wrap the byte boundary yourself)                  |

Encryption is deliberately out of scope: it's a higher-order wrapper at the
byte boundary (`cloud → withLocalCache → encryption → app`), a clean separation
from the transport.

## The two layers of a file backend

The folder, Dropbox, and Google Drive backends each expose two layers:

- **`FileStore`** — `list / read / write / remove` for one relative path. The
  low-level transport; it never interprets the bytes.
- **`create*Adapter`** — wraps that store in `createFileStoreAdapter`, the
  framework's canonical binding, which stores the whole document as a single
  file and adds optimistic-concurrency conflict detection, a reachability
  probe, and network-error retry.

If your app wants a richer on-disk layout (one browsable file per item), reuse
the `FileStore` and bring your own binding — the transports underneath don't
change.

## Versioning the bytes: `createMigrator`

A `StorageAdapter` moves opaque `text`; turning that text back into your model
is your `parse` step's job. The moment your persisted shape changes, old
documents on disk (and in exports) no longer match your current parser — so the
shape at rest carries a numeric `version`, and a forward-only chain upgrades any
older document to the current one before your app sees it.

The framework owns the **engine**; the **chain** is your data model:

```ts
import {
  createMigrator,
  consoleLogger,
} from "@niclaslindstedt/oss-framework/storage";

// `migrations[N]` upgrades a v`N` document to v`N+1`. Keep every step forever —
// a document in the wild still depends on it to climb to today's shape.
const migrator = createMigrator({
  latestVersion: 2,
  migrations: {
    // v0 (pre-versioning) → v1: guarantee the array exists.
    0: (doc) => ({ ...doc, version: 1, items: doc.items ?? [] }),
    // v1 → v2: items used to be bare strings; lift them into objects.
    1: (doc) => ({
      ...doc,
      version: 2,
      items: (doc.items as unknown[]).map((it) =>
        typeof it === "string" ? { label: it, done: false } : it,
      ),
    }),
  },
  logger: consoleLogger("migrate"), // optional; default is silent
});

// On load: parse, then migrate before handing the model to your app.
function load(raw: string): MyDoc {
  const { data } = migrator.migrate(JSON.parse(raw));
  return toMyDoc(data);
}

// On save: stamp the version the migrator targets, so the chain stays honest.
function save(doc: MyDoc): string {
  return JSON.stringify({ version: migrator.latestVersion, ...serialize(doc) });
}
```

The rules the runner enforces:

- A value with **no numeric `version`** (or a corrupt one) reads as **v0** — the
  pre-versioning shape — so the chain re-runs from the start.
- A non-object value (a `null`, a stray array) becomes an empty `{ version: 0 }`
  document, so a wiped or malformed file still upgrades cleanly.
- A document **newer than `latestVersion`** throws (a user on an older build must
  not silently down-convert data a newer build wrote).
- A **gap in the chain** throws (a missing `migrations[N]`).
- `migrate` returns `{ data, migrated }` — `migrated` is `true` only when a step
  actually ran, so you can re-persist the upgraded bytes once and skip the write
  when nothing changed.

Versioning is a property of the **bytes at rest**, not your in-memory model:
your domain types stay version-free; only the persisted JSON carries `version`,
written by `save` and consumed by `migrate`.

## Quick start

### Browser (default, on-device)

```ts
const adapter = new BrowserLocalStorageAdapter({ key: "myapp:document" });
```

The only backend with a synchronous `loadSync()` — paint from stored bytes on
the first frame instead of flashing an empty state.

### Local folder (File System Access API)

```ts
import {
  isFolderBackendAvailable,
  loadDirectoryHandle,
  saveDirectoryHandle,
  ensurePermission,
  createFolderAdapter,
} from "@niclaslindstedt/oss-framework/storage";

const handle = await window.showDirectoryPicker();
await saveDirectoryHandle(handle); // persists across reloads (IndexedDB)
await ensurePermission(handle, true); // request inside the click gesture
const adapter = createFolderAdapter(handle, { fileName: "myapp.json" });
```

### Dropbox

```ts
import {
  startDropboxAuth,
  completeDropboxAuth,
  createDropboxAdapter,
  withLocalCache,
  localCacheKey,
} from "@niclaslindstedt/oss-framework/storage";

// 1. On "Connect": redirect to consent (PKCE). `appKey` is your Dropbox app key.
await startDropboxAuth(appKey);
// 2. On redirect back, trade the ?code= for tokens, then persist them yourself.
const { accessToken, refreshToken } = await completeDropboxAuth(appKey, code);
// 3. Build the adapter, wrapped so the document is readable offline.
const adapter = withLocalCache(
  createDropboxAdapter({
    accessToken,
    refreshToken,
    onAccessTokenRefreshed: persistAccessToken, // silent-refresh feeds tokens back
  }),
  { storage: localStorage, key: localCacheKey("dropbox", "main") },
);
```

### Google Drive

```ts
import {
  startGdriveAuth,
  createGdriveAdapter,
  withLocalCache,
  localCacheKey,
} from "@niclaslindstedt/oss-framework/storage";

const token = await startGdriveAuth(googleClientId); // GIS consent popup
const adapter = withLocalCache(
  createGdriveAdapter(token, { appFolderName: "MyApp" }),
  { storage: localStorage, key: localCacheKey("gdrive", "main") },
);
```

Drive uses the GIS popup flow (no refresh token) — re-prompt with
`startGdriveAuth` on an `AuthError`. The `drive.file` scope (`GDRIVE_SCOPE`)
limits the app to files it created.

## Offline cache

`withLocalCache(adapter, { storage, key })` mirrors a cloud backend's bytes into
`localStorage`: it serves the cached copy (flagged `offline: true`) on a network
failure, queues an offline `save` for retry, and adds a synchronous `loadSync()`
for instant first paint. Typed errors (auth / conflict / rate-limit) pass
through untouched so their handling still fires — only a true network failure
falls back to the cache.

## Injecting a logger and `fetch`

The cloud adapters emit per-request sync diagnostics, but a library shouldn't
pick the sink. Pass a `logger` (`noopLogger` by default, `consoleLogger(scope)`
for devtools, or your own) to any adapter. Pass a `fetchImpl` to stub the
network in tests.

## Retrying the save path

A flaky mobile link drops 5xx and bare network errors that a single retry would
sail past. `save-retry.ts` is the **policy** for that — pure, so you can
unit-test the schedule without a fake timer or a live adapter. The framework
ships the policy; the **engine that applies it (the save queue, the
`setTimeout`, the dirty flag) stays in your app** — it's fused with your
document store and not reusable.

- **`backoffDelayMs(attempt, options?, rand?)`** — equal-jitter exponential
  backoff. The deterministic cap for an attempt is
  `min(maxMs, baseMs * factor^attempt)` and the returned delay lands in
  `[cap/2, cap)`. Equal jitter (vs. full jitter) guarantees each wait is at
  least half the cap, so the curve always makes forward progress while still
  de-correlating concurrent clients. `options` defaults to
  `{ baseMs: 500, factor: 2, maxMs: 30_000 }`; `rand` is injectable so a test
  can pin the jitter.
- **`isRetryableSaveError(err)`** — `false` for the three typed adapter signals
  (`ConflictError` / `AuthError` / `RateLimitError`), each of which has dedicated
  upstream handling (resolution modal / reconnect prompt / throttle cooldown);
  `true` for everything else, which is treated as a momentary backend hiccup
  worth a bounded retry.
- **`MAX_TRANSIENT_SAVE_RETRIES`** — how many automatic retries to spend on a
  transient failure before surfacing a hard `error`. The first attempt isn't a
  retry, so the worst case is `1 + MAX_TRANSIENT_SAVE_RETRIES` calls to
  `adapter.save`.
- **`OFFLINE_RESUME_MS`** — the gentle, **unbudgeted** interval for resuming a
  save that failed because the backend was unreachable (vs. a transient 5xx). An
  offline mirror (`withLocalCache`) has already persisted the bytes, so an
  offline failure is never a hard error and never spends the transient budget —
  it just retries slowly until the link recovers.

```ts
let attempt = 0;
async function trySave(snapshot) {
  try {
    await adapter.save(snapshot);
    attempt = 0;
  } catch (err) {
    if (!isRetryableSaveError(err) || attempt >= MAX_TRANSIENT_SAVE_RETRIES) {
      throw err; // give up → surface a hard error, or let typed handling fire
    }
    setTimeout(() => trySave(snapshot), backoffDelayMs(attempt++));
  }
}
```

## Sweeping many files at once

The save path is one small request; a **sweep** — reading or writing the
hundreds of files a media-carrying document externalises — is the other shape,
and it fails differently. `transfer-retry.ts` is what makes one survive a real
network:

- **`mapLimit(items, limit, fn)`** — `items.map(fn)` with at most `limit` calls
  in flight, results in input order. This is the actual fix: the throttling a
  naive `Promise.all` provokes is largely self-inflicted, and past a browser's
  per-host connection budget a fetch is rejected outright with a bare
  `TypeError` — nothing is wrong with the file, the request never left.
  `DEFAULT_TRANSFER_CONCURRENCY` (4) is the sane ceiling.
- **`withTransientRetries(label, op, options?)`** — retries `op` through a
  throttle or a transient network failure. A `RateLimitError` waits exactly as
  long as the provider asked (clamped by `maxWaitMs`, so a hostile
  `Retry-After` can't wedge the sweep); everything else backs off through
  `backoffDelayMs`. Gives up after `attempts` (default
  `DEFAULT_TRANSFER_ATTEMPTS`) and rethrows, so the caller's existing "leave it
  unread" handling still applies. `wait` is injectable, so a test spends no
  real seconds asleep.
- **`isTransientTransferError(err)`** / **`TransientHttpError`** — the
  predicate and the 5xx signal behind it. Note the deliberate difference from
  `isRetryableSaveError`: there a `RateLimitError` is _not_ retried, because
  the save path answers a throttle with its own cooldown; a sweep has no such
  scheduler, so it waits and carries on.

```ts
const files = await mapLimit(paths, DEFAULT_TRANSFER_CONCURRENCY, (path) =>
  withTransientRetries(`read ${path}`, () => store.read(path), { log }).catch(
    () => null, // a file that stays unreadable is one the app renders without
  ),
);
```

## Keeping records on the device (`createIdbStore`)

Keyed record stores over IndexedDB, for what a _device_ keeps rather than what
a backend holds: an offline cache of media bytes, an unsaved working document,
anything document-shaped that must not go in localStorage — which is a few
megabytes, spent synchronously on the UI thread.

```ts
const tapes = createIdbStore<string>({
  dbName: "myapp:scratch", // namespace it; one origin, many apps
  storeName: "tapes",
});

await tapes.set(namespaceSlug, markdown);
const restored = await tapes.get(namespaceSlug); // null on a first visit
```

Three choices are yours, and each is a decision the module cannot make for you.

### Where the key lives

A store with no `keyPath` takes its key **out-of-line**, beside the value, so a
record can be any structured-cloneable thing — a string of markdown, a byte
array. `createInlineIdbStore` is the other scheme: the key is read out of the
record itself, which is what you want when the record already carries its own
identity.

```ts
const files = createInlineIdbStore<DeviceFile>({
  dbName: "myapp:scratch",
  storeName: "files",
  keyPath: "path", // a record IS { path, text, … }
});

await files.put({ path: "notes/a.md", text }); // no key beside it
```

The choice is permanent — an object store cannot change its key scheme after it
is created — so the two schemes get different write methods (`set(key, value)`
vs `put(value)`) rather than one method that throws half the time.

### What a failure means

**Best-effort by default**: a private window, a denied quota, IndexedDB
switched off, a node test environment — all resolve to "nothing there" rather
than throwing, so a caller never guards a cache it treats as an optimisation.

Pass **`strict: true`** for a store that is where something _lives_. Then a
failure rejects, and the caller can surface it as the failed save it is. A
record that simply isn't there still answers `null` — absent is not a failure.

```ts
const files = createInlineIdbStore<DeviceFile>({
  …,
  strict: true, // a write that doesn't land must not look like a success
});
```

### How many stores share one database

IndexedDB versions a **database**, not a store, so every store in one database
has to be created by the same upgrade — a second store added behind the first's
back is simply missing when a transaction asks for it. `createIdbDatabase`
takes the whole schema at once for exactly that reason, and hands out one
handle per store:

```ts
const db = createIdbDatabase({
  name: "myapp:scratch",
  version: 2,
  stores: {
    tapes: {}, // out-of-line keys
    files: { keyPath: "path" }, // in-line keys
    media: { keyPath: "key", indexes: { slug: "slug" } },
  },
});

const tapes = db.keyedStore<string>("tapes"); // best-effort scratch
const files = db.inlineStore<DeviceFile>("files", { strict: true }); // a backend
const media = db.inlineStore<MediaRecord>("media"); // a cache, with an index
```

Ask for the scheme a store was declared with; asking for the other one throws
with the store named, rather than failing later inside a transaction.
`createIdbStore` / `createInlineIdbStore` are sugar over this for the common
single-store case.

`setMany` / `putMany` / `deleteMany` run as one transaction (all of them land,
or none), and `indexes` (`name → keyPath` into an object record) lets
`getAllBy` read one subset — one workspace's records, say — on its own.

## API surface

- **`adapter.ts`** — `StorageAdapter`, `StoredSnapshot`, `AdapterCapability`,
  `StorageBackendId`; `ConflictError`, `AuthError`, `RateLimitError`.
- **`file-store.ts` / `file-store-adapter.ts`** — `FileStore`, `FileEntry`;
  `createFileStoreAdapter` (+ `FileStoreAdapterOptions`).
- **`local/`** — `BrowserLocalStorageAdapter`, `deleteLocalDocument`.
- **`folder/`** — `createFolderAdapter`, `createFolderFileStore`,
  `isFolderBackendAvailable`, `loadDirectoryHandle`, `saveDirectoryHandle`,
  `clearDirectoryHandle`, `ensurePermission`.
- **`dropbox/`** — `createDropboxAdapter`, `createDropboxFileStore`,
  `startDropboxAuth`, `completeDropboxAuth`, `hasPendingDropboxAuth`,
  `refreshDropboxAccessToken`, `deleteDropboxPath`, `dropboxApiArg`.
- **`gdrive/`** — `createGdriveAdapter`, `createGdriveFileStore`,
  `startGdriveAuth`, `preloadGdriveAuth`, `gdriveWebUrl`, `GDRIVE_SCOPE`.
- **`idb-store.ts`** — `createIdbDatabase`, `createIdbStore`,
  `createInlineIdbStore` (+ `IdbDatabase`, `IdbStoreSchema`, `IdbKeyedStore`,
  `IdbInlineStore`, `IdbReadStore`, `IdbStore`, `IdbStoreOptions`,
  `IdbStoreHandleOptions`).
- **`transfer-retry.ts`** — `mapLimit`, `withTransientRetries`,
  `isTransientTransferError`, `TransientHttpError`,
  `DEFAULT_TRANSFER_CONCURRENCY`, `DEFAULT_TRANSFER_ATTEMPTS`.
- **`save-retry.ts`** — `backoffDelayMs` (+ `BackoffOptions`),
  `isRetryableSaveError`, `MAX_TRANSIENT_SAVE_RETRIES`, `OFFLINE_RESUME_MS`.
- **shared** — `withLocalCache`, `localCacheKey`, `isOfflineError`,
  `describeStorageError`, `OfflineUnavailableError`; the OAuth PKCE helpers
  (`startAuth`, `completeAuth`, `refreshAccessToken`, `pickOauthProvider`,
  `redirectUri`); `toBase64Url` / `fromBase64Url`; `noopLogger`,
  `consoleLogger`; `bearerAuthHeader`, `parseRetryAfterMs`, `readErrorBody`.
