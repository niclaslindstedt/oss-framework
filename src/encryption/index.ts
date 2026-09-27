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

// The two passphrase failures, as classes.
export { EncryptionLockedError, WrongPasswordError } from "./errors.ts";

// The encryption kit: one hook for the whole lifecycle (on / off / locked /
// unlock / change / adopted from another device, optional or required), and
// the three pieces of UI an app drops in — the settings block, the gate that
// asks when an answer is needed, and the dialog both use. One labels object
// translates all of it.
export {
  PASSPHRASE_MIN_LENGTH,
  classifyStored,
  useEncryption,
  type Encryption,
  type EncryptionMemory,
  type EncryptionPolicy,
  type EncryptionProgress,
  type EncryptionState,
  type EncryptionStep,
  type PassphraseStorage,
  type UseEncryptionOptions,
} from "./useEncryption.ts";
export { EncryptionSettings } from "./EncryptionSettings.tsx";
export { EncryptionGate } from "./EncryptionGate.tsx";
export {
  PassphraseDialog,
  type PassphraseDialogLabels,
  type PassphraseDialogMode,
} from "./PassphraseDialog.tsx";
// 3.7.0's narrower hook, now a view of `useEncryption`.
export {
  useRequiredEncryption,
  type RequiredEncryption,
  type RequiredEncryptionState,
  type UseRequiredEncryptionOptions,
} from "./useRequiredEncryption.ts";
export {
  DEFAULT_ENCRYPTION_LABELS,
  resolveEncryptionLabels,
  type EncryptionLabels,
} from "./labels.ts";

// A soft app lock: the PIN verifier, the hook, its settings control, and the
// gate (`AppLock` wraps a shell in it).
export {
  PIN_MIN_LENGTH,
  createPinVerifier,
  isPinVerifier,
  verifyPin,
  type PinVerifier,
} from "./pin.ts";
export {
  usePinLock,
  type PinLock,
  type UsePinLockOptions,
} from "./usePinLock.ts";
export {
  PinLockControl,
  type PinLockControlLabels,
} from "./PinLockControl.tsx";
export { AppLock, PinGate, type PinGateLabels } from "./PinGate.tsx";
