// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Bind any `FileStore` to a `StorageAdapter` by storing the whole document as
// a single file. This is the framework's canonical binding: it gives the
// folder, Dropbox, and Google Drive transports a ready-to-use adapter with
// optimistic-concurrency conflict detection, a probe, and network-error
// retry, without knowing anything about an app's data model.
//
// An app whose on-disk layout is richer — one file per item so the files are
// browsable / editable by hand — brings its own binding over the same
// `FileStore` instead of this one. The transports below it don't change; only
// the document⇄file mapping does.

import {
  AuthError,
  ConflictError,
  type StorageAdapter,
  type StorageBackendId,
  type StoredSnapshot,
} from "./adapter.ts";
import { isOfflineError } from "./cache/index.ts";
import type { FileEntry, FileStore } from "./file-store.ts";
import { type Logger, noopLogger } from "./logger.ts";

export type FileStoreAdapterOptions = {
  id: StorageBackendId;
  label: string;
  /** Relative path the document is stored under. Defaults to `document.json`. */
  fileName?: string;
  saveDebounceMs?: number;
  logger?: Logger;
  /**
   * Per-op network-error retry schedule, in ms — one entry per *retry* after
   * the first attempt. On a flaky link a single dropped request (a raw
   * `TypeError`, the way `fetch` rejects when a request can't complete) would
   * otherwise fail the whole load / save. All four `FileStore` ops are
   * idempotent, so a retry can never corrupt state. Defaults to a short bounded
   * curve; pass `[]` to disable (tests, or the local folder backend, which
   * never raises network errors).
   */
  retryDelaysMs?: readonly number[];
};

const DEFAULT_FILE_NAME = "document.json";

// Three retries on a network error, backing off ~0.3s → 0.6s → 1.2s. Bounded
// so a genuinely-down backend still fails quickly enough to fall back to an
// offline cache, while a single dropped request on a flaky link gets a few
// chances to land.
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [300, 600, 1200];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Wrap a `FileStore` so each operation retries on a *network* error — never a
// typed Auth/Conflict/RateLimit signal, which carry their own upstream
// handling.
function withRetry(inner: FileStore, delaysMs: readonly number[]): FileStore {
  async function run<T>(op: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await op();
      } catch (err) {
        if (!isOfflineError(err) || attempt >= delaysMs.length) throw err;
        await sleep(delaysMs[attempt]!);
      }
    }
  }
  return {
    list: () => run(() => inner.list()),
    read: (path) => run(() => inner.read(path)),
    write: (path, text) => run(() => inner.write(path, text)),
    remove: (path) => run(() => inner.remove(path)),
  };
}

export function createFileStoreAdapter(
  rawStore: FileStore,
  options: FileStoreAdapterOptions,
): StorageAdapter {
  const fileName = options.fileName ?? DEFAULT_FILE_NAME;
  const log = options.logger ?? noopLogger;
  // Every load / save goes through the retrying wrapper so a flaky per-request
  // failure doesn't doom the whole operation. `probe` deliberately calls the
  // raw store so the reachability check stays a single quick request.
  const store = withRetry(
    rawStore,
    options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS,
  );

  // The document's current revision is the per-file rev the store reports for
  // our one file; absent (file not yet written) it is undefined.
  function revisionOf(entries: readonly FileEntry[]): string | undefined {
    return entries.find((e) => e.path === fileName)?.rev;
  }

  async function load(): Promise<StoredSnapshot | null> {
    const entries = await store.list();
    const text = await store.read(fileName);
    if (text === null) return null;
    return { text, revision: revisionOf(entries) };
  }

  async function save(
    text: string,
    baseRevision?: string,
  ): Promise<StoredSnapshot> {
    if (baseRevision !== undefined) {
      const current = revisionOf(await store.list());
      // The file moved past the revision the caller based on — another device
      // (or tab) wrote in between. Hand back the remote bytes so the caller can
      // resolve rather than clobbering them.
      if (current !== undefined && current !== baseRevision) {
        const remoteText = await store.read(fileName);
        if (remoteText !== null) {
          log.warn("save: remote revision moved — conflict");
          throw new ConflictError({ text: remoteText, revision: current });
        }
      }
    }
    await store.write(fileName, text);
    return { text, revision: revisionOf(await store.list()) };
  }

  async function getRevision(): Promise<string | null> {
    return revisionOf(await store.list()) ?? null;
  }

  // Cheap reachability check: a single directory listing on the *raw* store
  // (no retry, no file bodies) so it stays one quick request. A lapsed session
  // re-throws `AuthError` so the caller routes to Reconnect; any other failure
  // counts as "not reachable" so the UI doesn't claim we're back online on a
  // backend that's still erroring.
  async function probe(): Promise<boolean> {
    try {
      await rawStore.list();
      return true;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      if (!isOfflineError(err)) log.warn("probe: reachable but errored", err);
      return false;
    }
  }

  return {
    id: options.id,
    label: options.label,
    saveDebounceMs: options.saveDebounceMs,
    capabilities: new Set(["probe", "getRevision"]),
    load,
    save,
    getRevision,
    probe,
  };
}
