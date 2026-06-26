// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Higher-order adapter that mirrors a remote backend's bytes into a local
// cache (this device's `Storage`) so the document can be read — and edited —
// while the network is unreachable (airplane mode, a dead tunnel, a captive
// portal). The mirror logic — write-through on every successful load / save,
// fall back to the cache on a *network* failure, and leave the typed errors
// (auth / conflict / rate-limit) alone so their upstream handling still fires
// — is identical for Dropbox and Google Drive, so it lives once here rather
// than inside each cloud adapter.
//
// Layer it directly over a cloud adapter:
//
//   withLocalCache(createDropboxAdapter({ auth }), { storage, key })
//
// If an app also wraps the byte boundary in encryption, the cache sits *below*
// it (`cloud → withLocalCache → withEncryption → app`) so the cached bytes are
// exactly what the cloud holds and the cache never sees plaintext.

import {
  AuthError,
  ConflictError,
  RateLimitError,
  type AdapterCapability,
  type StorageAdapter,
  type StoredSnapshot,
} from "../adapter.ts";
import { type Logger, noopLogger } from "../logger.ts";

/**
 * Raised by callers that need a backend round-trip but found neither the
 * network nor a cached copy to fall back on — e.g. opening a brand-new device
 * while offline, before anything has ever been pulled down. Distinct so the UI
 * can say "you're offline" instead of a misleading generic failure.
 */
export class OfflineUnavailableError extends Error {
  constructor(message = "Backend is unreachable and nothing is cached yet") {
    super(message);
    this.name = "OfflineUnavailableError";
  }
}

/**
 * A failure means "serve the cache" only when it's a raw network error, never
 * one of the adapter's typed signals: a `ConflictError` / `AuthError` /
 * `RateLimitError` each has dedicated handling upstream, and quietly returning
 * a stale cached read instead would mask it.
 */
export function isOfflineError(err: unknown): boolean {
  if (
    err instanceof ConflictError ||
    err instanceof AuthError ||
    err instanceof RateLimitError
  ) {
    return false;
  }
  // `fetch` rejects with a TypeError when the request can't be made at all
  // (DNS failure, connection refused, airplane mode) — the one reliable signal
  // that the request never reached the host.
  //
  // `navigator.onLine` is deliberately NOT consulted: it is unreliable across
  // platforms — it routinely reports `false` with perfectly working
  // connectivity (Linux network-manager quirks, VPNs, captive portals). A
  // failed `fetch` already throws here when the network is truly down, and the
  // active reachability probe (see `StorageAdapter.probe`) is what confirms —
  // and recovers from — the offline state.
  return err instanceof TypeError;
}

/**
 * Turn a save/load failure into a human-readable phrase for a log or a
 * sync-details surface. The raw signal a dead network throws is a bare
 * `TypeError` whose `.message` is engine-specific and cryptic — WebKit/Safari
 * says "Load failed", Chromium says "Failed to fetch" — so recognise that case
 * and say plainly that the backend was unreachable, keeping the engine's
 * wording in parentheses for the record. Every other error already carries a
 * descriptive message, so pass it through verbatim.
 */
export function describeStorageError(err: unknown): string {
  if (isOfflineError(err)) {
    const raw = err instanceof Error ? err.message : String(err);
    return `backend unreachable — network request failed (${raw})`;
  }
  return err instanceof Error ? err.message : String(err);
}

type CachedBytes = { text: string; revision?: string };

/**
 * Build a stable `Storage` key for a backend's offline mirror, namespaced by
 * backend id and an app-chosen document scope so two backends (or two
 * documents) can't clobber each other's cache.
 */
export function localCacheKey(backendId: string, scope: string): string {
  return `oss:cache:${backendId}:${scope}`;
}

export type LocalCacheOptions = {
  /** Where to persist the mirror — `localStorage` in the app, a stub in tests. */
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  /** Storage key. Namespace it per backend (and per document) at the call site. */
  key: string;
  /** Optional sink for cache diagnostics. Defaults to a no-op. */
  logger?: Logger;
};

export function withLocalCache(
  inner: StorageAdapter,
  options: LocalCacheOptions,
): StorageAdapter {
  const { storage, key } = options;
  const log = options.logger ?? noopLogger;

  function readCache(): CachedBytes | null {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as CachedBytes;
      if (typeof parsed?.text !== "string") return null;
      return parsed;
    } catch (err) {
      log.warn("readCache failed", err);
      return null;
    }
  }

  function writeCache(value: CachedBytes): void {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      log.warn("writeCache failed", err);
    }
  }

  function clearCache(): void {
    try {
      storage.removeItem(key);
    } catch (err) {
      log.warn("clearCache failed", err);
    }
  }

  // Advertise the synchronous fast path on top of the inner capabilities. The
  // cloud adapters carry no `loadSync` of their own — every byte they hold is a
  // network round-trip away — so on reload the first paint would show an empty
  // state until `load()` resolves. The mirror already sits in `Storage`, so we
  // can hand back that (possibly stale) copy synchronously for an instant first
  // paint; the `load()` the app fires on mount replaces it with the live
  // document a moment later.
  const capabilities = new Set<AdapterCapability>(inner.capabilities);
  capabilities.add("loadSync");

  return {
    id: inner.id,
    label: inner.label,
    saveDebounceMs: inner.saveDebounceMs,
    capabilities,
    getRevision: inner.getRevision ? () => inner.getRevision!() : undefined,
    // Reachability is a property of the live backend, not the mirror — pass the
    // probe straight through so a "Check connection" affordance hits the real
    // network.
    probe: inner.probe ? () => inner.probe!() : undefined,

    loadSync(): StoredSnapshot | null {
      const cached = readCache();
      if (!cached) return null;
      // No `offline` flag: this is a head-start for the first paint, not a
      // statement about connectivity. The `load()` that follows on mount does
      // the live round-trip and sets `offline` from its outcome.
      return { text: cached.text, revision: cached.revision };
    },

    async load(): Promise<StoredSnapshot | null> {
      try {
        const snap = await inner.load();
        if (snap) {
          writeCache({ text: snap.text, revision: snap.revision });
        } else {
          // The remote genuinely has nothing — drop any stale mirror so an
          // offline read can't resurrect a document that was deleted.
          clearCache();
        }
        return snap;
      } catch (err) {
        if (isOfflineError(err)) {
          const cached = readCache();
          if (cached) {
            log.info("load: backend offline — serving cached copy");
            return { ...cached, offline: true };
          }
          log.warn("load: backend offline and no cached copy");
        }
        // Either a real (typed) error, or offline with an empty cache. Let the
        // caller decide.
        throw err;
      }
    },

    async save(text: string, baseRevision?: string): Promise<StoredSnapshot> {
      try {
        const stored = await inner.save(text, baseRevision);
        writeCache({ text: stored.text, revision: stored.revision });
        return stored;
      } catch (err) {
        if (isOfflineError(err)) {
          // Persist the attempted bytes locally so the edit survives an offline
          // reload; keep the last good revision so the eventual reconnect save
          // bases on the right baseline. Re-throw so the caller keeps the edit
          // queued and retries it when the network returns.
          writeCache({ text, revision: readCache()?.revision });
          log.info("save: backend offline — cached locally, will retry");
        }
        throw err;
      }
    },

    watch: inner.watch ? (cb) => inner.watch!(cb) : undefined,
  };
}
