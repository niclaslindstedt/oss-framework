// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public storage surface, available under the
// "@niclaslindstedt/oss-framework/storage" subpath.
//
// The framework owns the byte-level storage seam: the `StorageAdapter`
// contract, the four backends (browser, local folder, Dropbox, Google Drive),
// their shared OAuth / HTTP plumbing, and an offline-cache wrapper. What stays
// in an app is the serialize / parse / migrate pipeline that turns its data
// model into the `text` an adapter moves — adapters never see domain values.
//
// Each file backend exposes two layers: a low-level `FileStore` (move bytes for
// one path) and a ready `create*Adapter` that binds it through the framework's
// single-file binding (`createFileStoreAdapter`). An app whose on-disk layout
// is richer (one file per item) reuses the `FileStore` and brings its own
// binding instead.

// The contract + errors.
export {
  AuthError,
  ConflictError,
  RateLimitError,
  type AdapterCapability,
  type StorageAdapter,
  type StorageBackendId,
  type StoredSnapshot,
} from "./adapter.ts";

// The file-backend seam and the generic single-file binding.
export { type FileEntry, type FileStore } from "./file-store.ts";
export {
  createFileStoreAdapter,
  type FileStoreAdapterOptions,
} from "./file-store-adapter.ts";

// The logger seam.
export { consoleLogger, noopLogger, type Logger } from "./logger.ts";

// Offline-cache wrapper + the error helpers it defines.
export {
  describeStorageError,
  isOfflineError,
  localCacheKey,
  OfflineUnavailableError,
  withLocalCache,
  type LocalCacheOptions,
} from "./cache/index.ts";

// Shared HTTP + OAuth plumbing (for apps wiring their own cloud flows / stores).
export {
  bearerAuthHeader,
  parseRetryAfterMs,
  readErrorBody,
  type FetchImpl,
} from "./http-utils.ts";
export { fromBase64Url, toBase64Url } from "./base64url.ts";
export {
  completeAuth,
  pickOauthProvider,
  redirectUri,
  refreshAccessToken,
  startAuth,
  type OAuthConfig,
  type TokenResult,
} from "./oauth-pkce.ts";

// Backends.
export {
  BrowserLocalStorageAdapter,
  deleteLocalDocument,
  type BrowserLocalStorageOptions,
} from "./local/index.ts";

export {
  clearDirectoryHandle,
  createFolderAdapter,
  createFolderFileStore,
  ensurePermission,
  isFolderBackendAvailable,
  loadDirectoryHandle,
  saveDirectoryHandle,
  type CreateFolderAdapterOptions,
  type FolderFileStoreOptions,
  type FolderPermissionResult,
} from "./folder/index.ts";

export {
  completeDropboxAuth,
  createDropboxAdapter,
  createDropboxFileStore,
  deleteDropboxPath,
  dropboxApiArg,
  hasPendingDropboxAuth,
  refreshDropboxAccessToken,
  startDropboxAuth,
  type CreateDropboxAdapterOptions,
  type DropboxAuth,
  type DropboxAuthResult,
  type DropboxFileStoreOptions,
} from "./dropbox/index.ts";

export {
  createGdriveAdapter,
  createGdriveFileStore,
  GDRIVE_SCOPE,
  gdriveWebUrl,
  preloadGdriveAuth,
  startGdriveAuth,
  type CreateGdriveAdapterOptions,
  type GdriveFileStoreOptions,
} from "./gdrive/index.ts";
