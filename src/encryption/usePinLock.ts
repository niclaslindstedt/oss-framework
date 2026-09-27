// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// An app lock: a PIN asked for before the app opens on this device, and again
// after it has sat in the background for a while. A *soft* lock — see
// `pin.ts` for what that means and why the copy beside it has to say so. The
// verifier is kept in device storage and never travels: a PIN is a question
// this device asks, and each device sharing a document chooses its own.
//
// The hook owns the verifier and the locked flag; the gate and the settings
// control are separate components (`UnlockGate`, `PinLockControl`) so an app
// can place them where its shell wants them.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createPinVerifier,
  isPinVerifier,
  verifyPin,
  type PinVerifier,
} from "./pin.ts";
import type { PassphraseStorage } from "./useRequiredEncryption.ts";

export type UsePinLockOptions = {
  /** Where the verifier lives. Defaults to `localStorage`. */
  storage?: PassphraseStorage | null;
  storageKey: string;
  /**
   * Lock again once the page has been hidden for at least this long, so a
   * phone put down unlocked does not stay unlocked for good. `null` (the
   * default) locks only on a fresh load.
   */
  relockAfterMs?: number | null;
};

export type PinLock = {
  /** Whether a PIN is set on this device. */
  hasPin: boolean;
  /** Whether the app should be behind the gate right now. */
  locked: boolean;
  /** Try a code; resolves whether it matched (and unlocks if it did). */
  unlock: (code: string) => Promise<boolean>;
  /**
   * Set or change the PIN. When one is already set, `current` must match it;
   * resolves `false` (changing nothing) when it doesn't.
   */
  setPin: (code: string, current?: string) => Promise<boolean>;
  /** Remove the PIN, given the current one. Resolves whether it matched. */
  clearPin: (current: string) => Promise<boolean>;
};

function readVerifier(
  storage: PassphraseStorage | null,
  key: string,
): PinVerifier | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPinVerifier(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function usePinLock(options: UsePinLockOptions): PinLock {
  const { storageKey, relockAfterMs = null } = options;
  const storage =
    options.storage === undefined
      ? typeof localStorage === "undefined"
        ? null
        : localStorage
      : options.storage;

  const [verifier, setVerifier] = useState<PinVerifier | null>(() =>
    readVerifier(storage, storageKey),
  );
  // Locked from the first render when a PIN exists, so nothing behind the
  // gate paints first.
  const [locked, setLocked] = useState<boolean>(() => verifier !== null);

  const verifierRef = useRef(verifier);
  verifierRef.current = verifier;

  // Re-lock after a long enough spell in the background.
  useEffect(() => {
    if (relockAfterMs === null || typeof document === "undefined") return;
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (
        hiddenAt !== null &&
        verifierRef.current &&
        Date.now() - hiddenAt >= relockAfterMs
      ) {
        setLocked(true);
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [relockAfterMs]);

  const persist = useCallback(
    (next: PinVerifier | null) => {
      try {
        if (next) storage?.setItem(storageKey, JSON.stringify(next));
        else storage?.removeItem(storageKey);
      } catch {
        // Storage refused — the PIN holds for this session only.
      }
      setVerifier(next);
    },
    [storage, storageKey],
  );

  const unlock = useCallback(async (code: string): Promise<boolean> => {
    const stored = verifierRef.current;
    if (!stored) {
      setLocked(false);
      return true;
    }
    const ok = await verifyPin(code, stored);
    if (ok) setLocked(false);
    return ok;
  }, []);

  const setPin = useCallback(
    async (code: string, current?: string): Promise<boolean> => {
      const stored = verifierRef.current;
      if (stored && !(await verifyPin(current ?? "", stored))) return false;
      persist(await createPinVerifier(code));
      return true;
    },
    [persist],
  );

  const clearPin = useCallback(
    async (current: string): Promise<boolean> => {
      const stored = verifierRef.current;
      if (stored && !(await verifyPin(current, stored))) return false;
      persist(null);
      setLocked(false);
      return true;
    },
    [persist],
  );

  return {
    hasPin: verifier !== null,
    locked: locked && verifier !== null,
    unlock,
    setPin,
    clearPin,
  };
}
