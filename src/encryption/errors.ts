// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The two ways reading an encrypted document can fail for want of the right
// passphrase, as classes a caller can tell apart with `instanceof` instead of
// matching message text. The messages are the ones this module has always
// thrown, so code that still matches on them keeps working.

/**
 * The bytes are an envelope and the passphrase does not open it — a typo, a
 * passphrase changed on another device, or tampered bytes (AES-GCM cannot tell
 * those apart, and nor should the UI pretend to).
 */
export class WrongPasswordError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Wrong password", options);
    this.name = "WrongPasswordError";
  }
}

/**
 * The bytes are an envelope and no passphrase is held at all — the locked
 * state after a reload, before anyone has typed it.
 */
export class EncryptionLockedError extends Error {
  constructor() {
    super("Storage is encrypted; password is required");
    this.name = "EncryptionLockedError";
  }
}
