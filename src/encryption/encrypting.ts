// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Higher-order adapter that wraps any `StorageAdapter` and applies
// password-based encryption at the byte boundary. The underlying adapter still
// sees opaque bytes, so the same wrapper works whether the bytes ultimately
// live in localStorage, a Dropbox app folder, or a Google Drive file — the
// encryption lives entirely above the transport.
//
// The password is held by reference so it can change at runtime (enable /
// disable encryption from settings, or unlock after a reload) without
// re-creating the adapter. A null `passwordRef.current` means "pass through" —
// useful for the transitional window after a user enables encryption but before
// existing storage has been re-wrapped, and for writing the very first
// plaintext before a passphrase is set.

import {
  ConflictError,
  type AdapterCapability,
  type StorageAdapter,
  type StoredSnapshot,
} from "../storage/adapter.ts";
import { type Logger, noopLogger } from "../storage/logger.ts";

import { decryptEnvelope, encryptText, isEncryptedEnvelope } from "./crypto.ts";
import { EncryptionLockedError } from "./errors.ts";

/**
 * A live handle on the session passphrase. The value can change between calls
 * (enable/disable, unlock); the wrapper reads `.current` fresh on every
 * `load`/`save`/`watch` so it always sees the latest. `null` = pass bytes
 * through unencrypted. A plain `useRef` satisfies this in React; any mutable
 * `{ current }` box works elsewhere.
 */
export type PasswordRef = { readonly current: string | null };

/** Options for {@link withEncryption}. */
export type WithEncryptionOptions = {
  /**
   * Where the wrapper's per-operation diagnostics go (encrypt/decrypt timing,
   * passthrough notes). Defaults to a no-op — a library must not write to a
   * console it doesn't own. Pass {@link consoleLogger} or your own sink to see
   * them.
   */
  logger?: Logger;
  /**
   * Re-save a plaintext document as an envelope the moment a `load` finds one
   * while a passphrase is held, instead of waiting for the next edit to go
   * through `save`. Off by default, which keeps enabling encryption a pure
   * no-op on disk; turn it on where plaintext at rest is the thing being
   * prevented — a copy that has left the device — so an old plaintext copy is
   * sealed on first contact even when nothing has changed since. A failed
   * re-save (offline, a conflict) is logged and the plaintext is returned
   * as before; the next load tries again.
   */
  sealPlaintext?: boolean;
};

/**
 * Wrap `inner` so every `save` encrypts and every `load` decrypts against the
 * passphrase in `passwordRef`. Plaintext bytes already in the backend (or
 * arriving over `watch`) are passed through untouched, so enabling encryption
 * is non-destructive until a save re-wraps them.
 *
 * The returned adapter never advertises `loadSync`: decryption is asynchronous
 * even when the inner backend can serve bytes synchronously, so callers fall
 * back to `load()` and tolerate the brief loading state.
 */
export function withEncryption(
  inner: StorageAdapter,
  passwordRef: PasswordRef,
  options: WithEncryptionOptions = {},
): StorageAdapter {
  const log = options.logger ?? noopLogger;

  // Forward every inner capability except `loadSync` — decryption is async even
  // when the inner backend can serve bytes synchronously, so this wrapper never
  // implements the sync fast path.
  const capabilities = new Set<AdapterCapability>(inner.capabilities);
  capabilities.delete("loadSync");

  return {
    id: inner.id,
    label: `${inner.label} (encrypted)`,
    saveDebounceMs: inner.saveDebounceMs,
    capabilities,

    // No `loadSync`: even when the inner adapter can hand back bytes
    // synchronously, decryption is asynchronous. Callers fall back to `load()`.

    getRevision: inner.getRevision ? () => inner.getRevision!() : undefined,
    // Reachability doesn't involve the passphrase — forward the probe as-is.
    probe: inner.probe ? () => inner.probe!() : undefined,

    async load(): Promise<StoredSnapshot | null> {
      const snap = await inner.load();
      if (!snap) {
        log.info("load: inner returned null");
        return null;
      }
      if (!isEncryptedEnvelope(snap.text)) {
        // Plaintext leftover (e.g. encryption was just enabled and the
        // re-wrap hasn't run yet) — hand it back as-is so the document
        // survives the transition.
        log.info(`load: inner bytes are plaintext (${snap.text.length} B)`);
        const password = passwordRef.current;
        // An offline snapshot is a cached copy: a save from here would only
        // land in the cache, so the seal waits for a live read.
        if (options.sealPlaintext && password && !snap.offline) {
          try {
            const written = await inner.save(
              await encryptText(snap.text, password),
              snap.revision,
            );
            log.info("load: sealed the plaintext copy");
            return { ...written, text: snap.text };
          } catch (err) {
            log.warn("load: sealing the plaintext copy failed", err);
          }
        }
        return snap;
      }
      const password = passwordRef.current;
      if (!password) {
        log.error("load: encrypted envelope but no password available");
        throw new EncryptionLockedError();
      }
      log.info(`load: decrypting envelope (${snap.text.length} B)`);
      const start = performance.now();
      try {
        const text = await decryptEnvelope(snap.text, password);
        const ms = (performance.now() - start).toFixed(0);
        log.info(`load: decrypt ok (${ms}ms) → ${text.length} B plaintext`);
        return { ...snap, text };
      } catch (err) {
        const ms = (performance.now() - start).toFixed(0);
        log.error(`load: decrypt failed (${ms}ms)`, err);
        throw err;
      }
    },

    async save(text: string, baseRevision?: string): Promise<StoredSnapshot> {
      const password = passwordRef.current;
      if (!password) {
        log.warn(
          `save: no password — writing plaintext (${text.length} B) to inner [${inner.id}]`,
        );
      } else {
        log.info(`save: encrypting plaintext (${text.length} B)`);
      }
      const start = performance.now();
      const payload = password ? await encryptText(text, password) : text;
      if (password) {
        const ms = (performance.now() - start).toFixed(0);
        log.info(`save: encrypt ok (${ms}ms) → ${payload.length} B envelope`);
      }
      let written: StoredSnapshot;
      try {
        written = await inner.save(payload, baseRevision);
      } catch (err) {
        // A conflict carries the backend's newer copy for the caller to merge,
        // and that copy is ciphertext. Hand it up as plaintext — a caller
        // parsing the envelope as its document would merge in nothing, or
        // fail. A passphrase that cannot open it surfaces as the wrong one.
        if (
          err instanceof ConflictError &&
          password &&
          isEncryptedEnvelope(err.remote.text)
        ) {
          const text = await decryptEnvelope(err.remote.text, password);
          throw new ConflictError({ ...err.remote, text });
        }
        throw err;
      }
      // The caller compares revisions, not bytes, so it's safe to hand back the
      // plaintext alongside the revision the inner adapter produced for the
      // ciphertext.
      return { ...written, text };
    },

    watch: inner.watch
      ? (onRemoteChange) =>
          inner.watch!((snap) => {
            if (!isEncryptedEnvelope(snap.text)) {
              log.info("watch: remote bytes are plaintext — forwarding");
              onRemoteChange(snap);
              return;
            }
            const password = passwordRef.current;
            if (!password) {
              log.warn(
                "watch: remote is encrypted but no password — dropping update",
              );
              return;
            }
            decryptEnvelope(snap.text, password)
              .then((text) => {
                log.info("watch: decrypt ok — forwarding");
                onRemoteChange({ ...snap, text });
              })
              .catch((err) => {
                log.error("watch: decrypt failed — dropping update", err);
              });
          })
      : undefined,
  };
}
