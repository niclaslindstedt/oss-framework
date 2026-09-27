// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted storage backend client (re-exported from ./storage).

export {
  createSelfHostedClient,
  SelfHostedClient,
  type AccountInfo as SelfHostedAccount,
  type ClientState as SelfHostedClientState,
  type DeviceInfo as SelfHostedDevice,
  type SelfHostedClientOptions,
  type Session as SelfHostedSession,
} from "./client.ts";
export {
  Namespace as StorageNamespace,
  type BatchResult as NamespaceBatchResult,
  type Change as NamespaceChange,
  type Member as NamespaceMember,
  type NamespaceInfo as StorageNamespaceInfo,
  type NamespaceMeta as StorageNamespaceMeta,
  type NsRole as NamespaceRole,
  type PlainOp as NamespaceOp,
} from "./namespace.ts";
export { FileConflictError, NamespaceFiles, type FileInfo as NamespaceFileInfo, type WriteOptions as NamespaceWriteOptions } from "./files.ts";
export { RecordsApi, RowConflictError, type Row as NamespaceRow } from "./records-api.ts";
export {
  createMemoryRecordCache,
  defaultRowMerge,
  RecordStore,
  type LocalRow,
  type RecordCache,
  type RecordCacheState,
  type RecordStoreOptions,
  type RowMerge,
  type SyncResult,
} from "./record-store.ts";
export { createIdbRecordCache } from "./record-cache.ts";
export {
  createNamespaceAdapter,
  createNamespaceFileStore,
  type NamespaceAdapterOptions,
  type NamespaceFileStore,
} from "./adapters.ts";
export { createRowDocumentAdapter, type RowDocumentOptions } from "./row-document.ts";
export { jsonEqual, newerByField, threeWayMerge, type ConflictContext, type MergeOptions } from "./merge.ts";
export {
  createHostKeyVault,
  createIndexedDbKeyVault,
  createMemoryKeyVault,
  defaultKeyVault,
  getKeyVaultHost,
  KEY_VAULT_HOST_EVENT,
  KEY_VAULT_HOST_PROPERTY,
  type KeyVault,
  type KeyVaultHost,
  type VaultValue,
} from "./vault.ts";
export {
  formatPayload as formatStoragePayload,
  parsePayload as parseStoragePayload,
  PayloadError as StoragePayloadError,
  type InvitePayload as StorageInvitePayload,
  type PairingPayload as StoragePairingPayload,
  type Payload as StoragePayload,
} from "./payload.ts";
export { formatRecoveryKey, parseRecoveryKey, safetyCode } from "./crypto.ts";
export {
  ApiRequestError as StorageApiError,
  CursorExpiredError,
  DecryptError,
  ForbiddenError as StorageForbiddenError,
  KeysMissingError,
  NotFoundError as StorageNotFoundError,
  QuotaExceededError,
  RollbackError,
} from "./errors.ts";
export type { ServerEvent as StorageServerEvent } from "./transport.ts";
