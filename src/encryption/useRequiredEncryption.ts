// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Encryption as a *requirement* of a backend rather than a setting: while the
// document lives somewhere that is not this device — a cloud app folder, a
// picked folder some other program may be syncing — nothing is written there
// except an envelope, and nothing is read from there until a passphrase is
// held. The hook is the state machine around that rule; the crypto is
// `withEncryption`'s.
//
// The guarantee is structural. `adapter` is `null` whenever a required
// backend has no passphrase, so a sync engine that only ever talks to
// `adapter` has nothing to push plaintext through. A backend that does not
// require encryption gets its own adapter back untouched.
//
// **Where the passphrase lives.** By default it is remembered in the given
// `Storage` (localStorage) under `storageKey`, so a device asks for it once,
// not on every open. That is a deliberate trade and a sound one for an app
// whose working copy already sits in plaintext in the same storage: keeping
// the key beside it exposes nothing the device did not already expose, while
// the copy that left the device — the one the passphrase is for — stays
// unreadable to the provider holding it. An app whose on-device copy is itself
// sealed should pass `storage: null`, which holds the passphrase in memory for
// the session only.
//
// States, in the order a fresh connection walks them:
//
//   off         — no backend, or one that does not require encryption
//   checking    — looking at what the backend holds, to ask the right question
//   create      — nothing sealed there yet: choose a passphrase
//   unlock      — an envelope is there: enter the passphrase that sealed it
//   changed     — the remembered passphrase no longer opens it (it was
//                 changed on another device): enter the new one
//   unreachable — could not look, and no passphrase is held: `recheck` later
//   ready       — a passphrase is held and `adapter` is live

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StorageAdapter, StoredSnapshot } from "../storage/adapter.ts";
import { type Logger, noopLogger } from "../storage/logger.ts";

import { isEncryptedEnvelope } from "./crypto.ts";
import { withEncryption, type PasswordRef } from "./encrypting.ts";
import { WrongPasswordError } from "./errors.ts";

/** The shortest passphrase a create or change should accept. */
export const PASSPHRASE_MIN_LENGTH = 8;

export type RequiredEncryptionState =
  | "off"
  | "checking"
  | "create"
  | "unlock"
  | "changed"
  | "unreachable"
  | "ready";

/** Where a remembered passphrase is kept — `localStorage` satisfies it. */
export type PassphraseStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type UseRequiredEncryptionOptions = {
  /** The backend's own adapter, or `null` when none is connected. */
  inner: StorageAdapter | null;
  /** Whether this backend may only ever hold envelopes. */
  required: boolean;
  /**
   * Where the passphrase is remembered on this device, keyed by
   * `storageKey`. Key it per backend, so a second backend is asked its own
   * question instead of silently inheriting the first one's answer. Defaults
   * to `localStorage`; `null` keeps it in memory for the session only.
   */
  storage?: PassphraseStorage | null;
  storageKey: string;
  logger?: Logger;
};

export type RequiredEncryption = {
  state: RequiredEncryptionState;
  /**
   * The adapter to sync through: `inner` itself when encryption is not
   * required, `inner` sealed under the passphrase when it is and one is held,
   * and `null` otherwise — so plaintext has no path out.
   */
  adapter: StorageAdapter | null;
  /** The error that left the state `unreachable`, for a status line. */
  error: unknown;
  /** Choose the passphrase for a backend that holds nothing sealed yet. */
  create: (passphrase: string) => Promise<void>;
  /**
   * Try a passphrase against what the backend holds. Rejects with a
   * {@link WrongPasswordError} when it does not open it, and with the
   * backend's own error when it cannot be read at all.
   */
  unlock: (passphrase: string) => Promise<void>;
  /**
   * Re-seal the backend's copy under a new passphrase and remember that one
   * instead. Other devices land in `changed` on their next read and are asked
   * for it. Rejects, changing nothing, when the backend is unreachable.
   */
  change: (next: string) => Promise<void>;
  /** Drop the remembered passphrase — on a disconnect. */
  forget: () => void;
  /** Look at the backend again after `unreachable`. */
  recheck: () => void;
};

function readStored(
  storage: PassphraseStorage | null,
  key: string,
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStored(
  storage: PassphraseStorage | null,
  key: string,
  value: string | null,
): void {
  if (!storage) return;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage refused (private mode, quota) — the passphrase still holds for
    // this session; the device just asks again next time.
  }
}

/** What a backend holds, as far as the question to ask is concerned. */
export function classifyStored(
  snapshot: StoredSnapshot | null,
): "empty" | "plaintext" | "encrypted" {
  if (!snapshot || snapshot.text === "") return "empty";
  return isEncryptedEnvelope(snapshot.text) ? "encrypted" : "plaintext";
}

export function useRequiredEncryption(
  options: UseRequiredEncryptionOptions,
): RequiredEncryption {
  const { inner, required, storageKey } = options;
  const storage =
    options.storage === undefined
      ? typeof localStorage === "undefined"
        ? null
        : localStorage
      : options.storage;
  // Held in a ref so a logger built inline on every render doesn't re-run
  // the backend check or rebuild the adapter.
  const logRef = useRef<Logger>(noopLogger);
  logRef.current = options.logger ?? noopLogger;
  const log = useMemo<Logger>(
    () => ({
      info: (...args) => logRef.current.info(...args),
      warn: (...args) => logRef.current.warn(...args),
      error: (...args) => logRef.current.error(...args),
    }),
    [],
  );

  const [passphrase, setPassphrase] = useState<string | null>(() =>
    readStored(storage, storageKey),
  );
  // A live view for `withEncryption`, which reads it on every call.
  const passwordRef = useRef<string | null>(passphrase);
  passwordRef.current = passphrase;
  const ref: PasswordRef = passwordRef;

  // What the check found when no passphrase is held: which question to ask.
  const [question, setQuestion] = useState<
    "checking" | "create" | "unlock" | "changed" | "unreachable"
  >("checking");
  const [error, setError] = useState<unknown>(null);
  const [checkEpoch, setCheckEpoch] = useState(0);

  // A different key is a different backend: read its own answer.
  useEffect(() => {
    setPassphrase(readStored(storage, storageKey));
  }, [storage, storageKey]);

  const remember = useCallback(
    (next: string | null) => {
      writeStored(storage, storageKey, next);
      setPassphrase(next);
    },
    [storage, storageKey],
  );

  // Look at the backend whenever a required one has no passphrase, to tell
  // "choose one" from "enter the one you chose elsewhere". A `changed` verdict
  // is kept: the backend still holds an envelope, and the reason is the more
  // useful thing to show.
  useEffect(() => {
    if (!inner || !required || passphrase !== null) return;
    let cancelled = false;
    setQuestion((q) => (q === "changed" ? q : "checking"));
    setError(null);
    inner.load().then(
      (snap) => {
        if (cancelled) return;
        const kind = classifyStored(snap);
        log.info(`check: backend holds ${kind}`);
        setQuestion((q) =>
          kind === "encrypted" ? (q === "changed" ? q : "unlock") : "create",
        );
      },
      (err: unknown) => {
        if (cancelled) return;
        log.warn("check: backend unreadable", err);
        setError(err);
        setQuestion((q) => (q === "changed" ? q : "unreachable"));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [inner, required, passphrase, checkEpoch, log]);

  const ready = Boolean(inner && required && passphrase !== null);

  // Identity moves only when the backend or readiness does — not on a
  // passphrase change, which `withEncryption` picks up through the ref.
  const adapter = useMemo<StorageAdapter | null>(() => {
    if (!inner) return null;
    if (!required) return inner;
    if (!ready) return null;
    const sealed = withEncryption(inner, ref, {
      logger: log,
      sealPlaintext: true,
    });
    // A passphrase that stops opening the backend's copy was changed on
    // another device: forget it and ask for the new one.
    const lockout = (err: unknown): never => {
      if (err instanceof WrongPasswordError) {
        log.warn("the remembered passphrase no longer opens the backend");
        setQuestion("changed");
        remember(null);
      }
      throw err;
    };
    return {
      ...sealed,
      load: () => sealed.load().catch(lockout),
      save: (text, base) => sealed.save(text, base).catch(lockout),
    };
  }, [inner, required, ready, log, remember, ref]);

  const create = useCallback(
    async (next: string): Promise<void> => {
      if (!next) throw new Error("Passphrase is required");
      log.info("create: passphrase chosen");
      remember(next);
    },
    [log, remember],
  );

  const unlock = useCallback(
    async (candidate: string): Promise<void> => {
      if (!candidate) throw new Error("Passphrase is required");
      if (!inner) throw new Error("No backend connected");
      // A plaintext or empty backend opens with anything; an envelope opens
      // only with its own passphrase, and throws WrongPasswordError otherwise.
      await withEncryption(inner, { current: candidate }).load();
      log.info("unlock: passphrase accepted");
      remember(candidate);
    },
    [inner, log, remember],
  );

  const change = useCallback(
    async (next: string): Promise<void> => {
      if (!next) throw new Error("Passphrase is required");
      if (!inner) throw new Error("No backend connected");
      const current = passwordRef.current;
      if (!current) throw new Error("Unlock before changing the passphrase");
      // Offline, the re-seal would only reach a local cache while the backend
      // keeps the old envelope. Refuse up front rather than split them.
      if (inner.probe && !(await inner.probe())) {
        throw new TypeError("The backend is unreachable");
      }
      const snap = await withEncryption(inner, { current }).load();
      if (snap && !snap.offline) {
        await withEncryption(inner, { current: next }).save(
          snap.text,
          snap.revision,
        );
      } else if (snap?.offline) {
        throw new TypeError("The backend is unreachable");
      }
      log.info("change: backend re-sealed under the new passphrase");
      remember(next);
    },
    [inner, log, remember],
  );

  const forget = useCallback(() => {
    log.info("forget: passphrase dropped from this device");
    setQuestion("checking");
    remember(null);
  }, [log, remember, setQuestion]);

  const recheck = useCallback(
    () => setCheckEpoch((n) => n + 1),
    [setCheckEpoch],
  );

  const state: RequiredEncryptionState =
    !inner || !required ? "off" : ready ? "ready" : question;

  return { state, adapter, error, create, unlock, change, forget, recheck };
}
