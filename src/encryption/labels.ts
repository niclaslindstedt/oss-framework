// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Every visible string the encryption kit renders, with its English default.
// One object serves `EncryptionSettings`, `EncryptionGate` and the
// `PassphraseDialog` behind it, so an app translates the kit once and hands
// the same object to each. Every key is optional.
//
// `{location}` in a string is replaced with the `location` prop the
// components take ("Dropbox", "the folder"), so one sentence can name where
// the bytes go without the app assembling it.

import type { EncryptionStep } from "./useEncryption.ts";

export type EncryptionLabels = {
  /** The settings block's headline while encryption is on. */
  on?: string;
  /** …while it is off (optional policy only). */
  off?: string;
  /** Under the headline: what encryption does. */
  hint?: string;
  /** Under the headline when the policy is `required`. */
  requiredHint?: string;
  /** Status lines for the states that hold sync back. */
  checking?: string;
  setupNeeded?: string;
  lockedStatus?: string;
  changedStatus?: string;
  unreachable?: string;
  /** Where a remembered passphrase lives, said once under "on". */
  rememberedHint?: string;
  sessionHint?: string;

  /** Buttons. */
  enable?: string;
  disable?: string;
  unlock?: string;
  setPassphrase?: string;
  changePassphrase?: string;
  lock?: string;
  retry?: string;
  cancel?: string;
  close?: string;

  /** Dialog headings and bodies. */
  createTitle?: string;
  createHint?: string;
  unlockTitle?: string;
  unlockHint?: string;
  /** The locked copy when the lock came from discovering encryption set on
   *  another device, rather than from a reload. */
  unlockHintRemote?: string;
  changedTitle?: string;
  changedHint?: string;
  changeTitle?: string;
  changeHint?: string;
  noRecovery?: string;
  passphrase?: string;
  confirm?: string;
  createSubmit?: string;
  changeSubmit?: string;

  /** Validation and failures. `{min}` is the minimum length. */
  tooShort?: string;
  mismatch?: string;
  wrong?: string;
  offline?: string;
  failed?: string;
  /** Turning encryption off while the backend holds an envelope needs it open. */
  unlockFirst?: string;

  /** The phase line while the key is derived and the bytes move. */
  steps?: Partial<Record<EncryptionStep, string>>;
  /** Accessible name of the progress line. */
  statusAria?: string;
};

export const DEFAULT_ENCRYPTION_LABELS: Required<
  Omit<EncryptionLabels, "steps">
> & { steps: Record<EncryptionStep, string> } = {
  on: "Encryption is on",
  off: "Encryption is off",
  hint: "Everything is encrypted on this device with your passphrase before it goes to {location}, which only ever holds ciphertext.",
  requiredHint:
    "A copy in {location} is always encrypted on this device first — {location} only ever holds ciphertext.",
  checking: "Checking what {location} holds…",
  setupNeeded:
    "Waiting for a passphrase — nothing is stored in {location} until one is set.",
  lockedStatus: "Locked — enter the passphrase to read what {location} holds.",
  changedStatus:
    "The passphrase was changed on another device — enter the new one.",
  unreachable: "Couldn't reach {location} to check its encryption.",
  rememberedHint: "The passphrase is remembered on this device.",
  sessionHint:
    "The passphrase is held until the app is closed; you'll be asked again next time.",

  enable: "Turn on encryption",
  disable: "Turn off encryption",
  unlock: "Unlock",
  setPassphrase: "Set the passphrase",
  changePassphrase: "Change the passphrase",
  lock: "Lock now",
  retry: "Try again",
  cancel: "Cancel",
  close: "Close",

  createTitle: "Choose a passphrase",
  createHint:
    "Everything is encrypted on this device before it goes to {location}. Every device that opens it will need this passphrase.",
  unlockTitle: "Enter your passphrase",
  unlockHint:
    "What is stored in {location} is encrypted. Enter your passphrase to open it.",
  unlockHintRemote:
    "Encryption was turned on from another device. Enter the passphrase chosen there.",
  changedTitle: "The passphrase has changed",
  changedHint:
    "The passphrase was changed on another device. Enter the new one to keep going.",
  changeTitle: "Change the passphrase",
  changeHint:
    "The copy in {location} is re-encrypted with the new passphrase. Your other devices will ask for it.",
  noRecovery:
    "Nobody can recover a forgotten passphrase — not this app, not {location}. Write it down somewhere safe.",
  passphrase: "Passphrase",
  confirm: "Repeat the passphrase",
  createSubmit: "Encrypt",
  changeSubmit: "Change",

  tooShort: "Use at least {min} characters.",
  mismatch: "The two passphrases don't match.",
  wrong: "Wrong passphrase. Try again.",
  offline: "Can't reach {location} right now. Try again when you're online.",
  failed: "That didn't work. Try again.",
  unlockFirst: "Unlock first to turn encryption off.",

  steps: {
    reading: "Reading what is stored…",
    derivingKey: "Deriving the key from your passphrase…",
    encrypting: "Encrypting…",
    decrypting: "Decrypting…",
    saving: "Saving…",
    finalizing: "Finishing up…",
  },
  statusAria: "Encryption progress",
};

/** Merge an app's labels over the defaults and fill `{location}`. */
export function resolveEncryptionLabels(
  labels: EncryptionLabels | undefined,
  location: string,
): typeof DEFAULT_ENCRYPTION_LABELS {
  const merged = {
    ...DEFAULT_ENCRYPTION_LABELS,
    ...labels,
    steps: { ...DEFAULT_ENCRYPTION_LABELS.steps, ...labels?.steps },
  };
  const fill = (s: string) => s.split("{location}").join(location);
  const out = { ...merged } as Record<string, unknown>;
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "string") out[k] = fill(v);
  }
  return out as typeof DEFAULT_ENCRYPTION_LABELS;
}
