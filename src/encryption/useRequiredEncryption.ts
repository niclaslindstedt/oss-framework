// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The 3.7.0 shape of "encryption a backend requires", kept so code written
// against it keeps compiling. It is now a thin view of `useEncryption` with
// `policy: "required"` and `remember: "device"` — use that directly.

import { useEncryption, type PassphraseStorage } from "./useEncryption.ts";
import type { StorageAdapter } from "../storage/adapter.ts";
import type { Logger } from "../storage/logger.ts";

/** @deprecated Use `EncryptionState` from `useEncryption`. */
export type RequiredEncryptionState =
  | "off"
  | "checking"
  | "create"
  | "unlock"
  | "changed"
  | "unreachable"
  | "ready";

/** @deprecated Use `UseEncryptionOptions`. */
export type UseRequiredEncryptionOptions = {
  inner: StorageAdapter | null;
  required: boolean;
  storage?: PassphraseStorage | null;
  storageKey: string;
  logger?: Logger;
};

/** @deprecated Use `Encryption`. */
export type RequiredEncryption = {
  state: RequiredEncryptionState;
  adapter: StorageAdapter | null;
  error: unknown;
  create: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  change: (next: string) => Promise<void>;
  forget: () => void;
  recheck: () => void;
};

/**
 * @deprecated Use `useEncryption({ adapter, policy: "required", remember:
 * "device", storageKey })`. The passphrase is kept at `<storageKey>` itself
 * here, as 3.7.0 kept it; `useEncryption` keeps it at `<storageKey>:passphrase`.
 */
export function useRequiredEncryption(
  options: UseRequiredEncryptionOptions,
): RequiredEncryption {
  const enc = useEncryption({
    adapter: options.required ? options.inner : null,
    policy: "required",
    remember: "device",
    storage: options.storage === undefined ? undefined : options.storage,
    storageKey: options.storageKey,
    passphraseKey: options.storageKey,
    logger: options.logger,
  });
  const state: RequiredEncryptionState =
    enc.state === "setup"
      ? "create"
      : enc.state === "locked"
        ? "unlock"
        : enc.state;
  return {
    state,
    adapter: options.required ? enc.adapter : options.inner,
    error: enc.error,
    create: (p) => enc.enable(p),
    unlock: (p) => enc.unlock(p),
    change: (p) => enc.changePassphrase(p),
    forget: enc.forget,
    recheck: enc.recheck,
  };
}
