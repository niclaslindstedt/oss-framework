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
| The `StorageAdapter` / `FileStore` contracts and the typed errors    | The serialize / parse / **migrate** pipeline that produces `text`     |
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
- **shared** — `withLocalCache`, `localCacheKey`, `isOfflineError`,
  `describeStorageError`, `OfflineUnavailableError`; the OAuth PKCE helpers
  (`startAuth`, `completeAuth`, `refreshAccessToken`, `pickOauthProvider`,
  `redirectUri`); `toBase64Url` / `fromBase64Url`; `noopLogger`,
  `consoleLogger`; `bearerAuthHeader`, `parseRetryAfterMs`, `readErrorBody`.
