// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public encryption surface, available under the
// "@niclaslindstedt/oss-framework/encryption" subpath.
//
// At-rest encryption for a local-first app: a self-describing AES-GCM + PBKDF2
// envelope (`crypto.ts`) plus a byte-boundary adapter wrapper (`withEncryption`)
// that slots above any `StorageAdapter` so the same passphrase protects bytes
// wherever they live (localStorage, a folder, a cloud app folder).
//
// What stays in your app: where the passphrase lives and how it's collected.
// There are no accounts here — the passphrase is held only in memory for the
// session, so after a reload the app is "locked" until the user re-enters it.
// The framework owns the crypto and the wrapper; your app owns the lock/unlock
// UI and the `passwordRef` it threads in.

// The envelope crypto (pure — no React, no storage).
export {
  decryptEnvelope,
  encryptText,
  isEncryptedEnvelope,
  parseEnvelope,
  type CryptoProgress,
  type CryptoProgressStep,
  type Envelope,
} from "./crypto.ts";

// The byte-boundary adapter wrapper.
export {
  withEncryption,
  type PasswordRef,
  type WithEncryptionOptions,
} from "./encrypting.ts";
