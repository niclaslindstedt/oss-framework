// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// At-rest encryption for a whole-document backend, as one hook: the state
// machine a local-first app would otherwise write around `withEncryption`
// itself — turning it on and off, the lock after a reload, unlocking,
// changing the passphrase, and noticing that another device turned it on.
// Modelled on the notes app's `useEncryption`, minus what is particular to
// notes (namespaces, per-file backends), and with one addition: a backend can
// *require* encryption, so that it is not a setting at all.
//
//   const enc = useEncryption({ adapter, storageKey: "my-app:enc" });
//   // sync through enc.adapter — null while locked, so nothing is written
//   // until the passphrase is held.
//
// **Two policies.**
//
//   - `optional` (the default): encryption is a setting. `enable` seals the
//     document now, `disable` writes it back as plaintext. The adapter passes
//     plaintext through while it is off, and if a read finds an envelope — a
//     second device turned encryption on — the hook adopts it and locks, the
//     way notes does ("encryption is enforced on every device that syncs").
//   - `required`: the backend may only ever hold envelopes. There is no off;
//     until a passphrase is set the adapter is `null`, so a sync engine that
//     only talks to it has no path to write plaintext. Use it for a copy that
//     leaves the device.
//
// **Two memories.**
//
//   - `session` (the default): the passphrase is held in memory. After a
//     reload the app is locked until it is typed again — right when the
//     on-device copy is itself the thing being protected.
//   - `device`: the passphrase is remembered in `storage` under the key, so a
//     device asks once. Right when the working copy already sits in plaintext
//     on the device and what is protected is the copy that leaves it — the key
//     beside it exposes nothing the device did not already.
//
// **States.** `off` (not encrypted, or no backend), `checking` (reading the
// backend to know which question to ask), `setup` (encrypted, nothing sealed
// yet: choose a passphrase), `locked` (an envelope, no passphrase held),
// `changed` (the held passphrase stopped opening it — changed elsewhere),
// `unreachable` (couldn't look; `recheck`), `ready` (sealing and opening).
//
// **Sticky by design.** Adoption only ever goes towards encrypted: a device
// that holds the passphrase re-seals a plaintext copy the first time it reads
// one. Turning encryption off is therefore a decision each device makes — the
// same trade notes makes, because the alternative lets any one device quietly
// unseal everyone's copy.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StorageAdapter, StoredSnapshot } from "../storage/adapter.ts";
import { type Logger, noopLogger } from "../storage/logger.ts";

import { decryptEnvelope, encryptText, isEncryptedEnvelope } from "./crypto.ts";
import { withEncryption } from "./encrypting.ts";
import { EncryptionLockedError, WrongPasswordError } from "./errors.ts";

/** The shortest passphrase `enable` and `changePassphrase` accept. */
export const PASSPHRASE_MIN_LENGTH = 8;

export type EncryptionPolicy = "optional" | "required";
export type EncryptionMemory = "session" | "device";

export type EncryptionState =
  "off" | "checking" | "setup" | "locked" | "changed" | "unreachable" | "ready";

/**
 * The phases a turn-on, turn-off, unlock or change passes through, so a UI
 * can flash one line while the (deliberately slow) key derivation runs.
 */
export type EncryptionStep =
  | "reading"
  | "derivingKey"
  | "encrypting"
  | "decrypting"
  | "saving"
  | "finalizing";
export type EncryptionProgress = (step: EncryptionStep) => void;

/** Where the mode and a remembered passphrase live — `localStorage` fits. */
export type PassphraseStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type UseEncryptionOptions = {
  /** The backend's own adapter, or `null` when none is connected. */
  adapter: StorageAdapter | null;
  /**
   * Prefix for this device's records: `<key>:mode` (whether encryption is on)
   * and, with `remember: "device"`, `<key>:passphrase`. Key it per backend so
   * each asks its own question.
   */
  storageKey: string;
  policy?: EncryptionPolicy;
  remember?: EncryptionMemory;
  /** Defaults to `localStorage`; `null` keeps everything in memory. */
  storage?: PassphraseStorage | null;
  /**
   * Where a `device` passphrase is kept, when it must not be the default
   * `<storageKey>:passphrase` (the deprecated `useRequiredEncryption` keeps
   * 3.7.0's key this way).
   */
  passphraseKey?: string;
  /** Minimum passphrase length. Defaults to {@link PASSPHRASE_MIN_LENGTH}. */
  minLength?: number;
  logger?: Logger;
};

export type Encryption = {
  state: EncryptionState;
  policy: EncryptionPolicy;
  remember: EncryptionMemory;
  minLength: number;
  /** Whether a backend is connected at all. */
  available: boolean;
  /** Whether every save is sealed: `required`, or turned on. */
  encrypted: boolean;
  /** Encrypted and no passphrase held — the app should ask for it. */
  locked: boolean;
  /** Locked because a read found encryption turned on elsewhere. */
  fromRemote: boolean;
  /**
   * The adapter to read and write through. Plaintext pass-through while off,
   * sealing and opening while ready, `null` whenever it is encrypted and no
   * passphrase is held.
   */
  adapter: StorageAdapter | null;
  /** What left the state `unreachable`. */
  error: unknown;
  /** Turn encryption on (or, in `setup`, choose the passphrase) and seal
   *  what the backend holds. */
  enable: (
    passphrase: string,
    onProgress?: EncryptionProgress,
  ) => Promise<void>;
  /** Write the document back as plaintext and turn encryption off. Throws
   *  under the `required` policy. */
  disable: (onProgress?: EncryptionProgress) => Promise<void>;
  /** Try a passphrase against the backend. Rejects with a
   *  {@link WrongPasswordError} when it does not open it. */
  unlock: (
    passphrase: string,
    onProgress?: EncryptionProgress,
  ) => Promise<void>;
  /** Re-seal the backend under a new passphrase. */
  changePassphrase: (
    next: string,
    onProgress?: EncryptionProgress,
  ) => Promise<void>;
  /** Drop the held passphrase — the state a reload leaves `session` in. */
  lock: () => void;
  /** Drop the passphrase and the mode — on a disconnect. */
  forget: () => void;
  /** Look at the backend again after `unreachable`. */
  recheck: () => void;
};

/** What a backend holds, as far as the question to ask is concerned. */
export function classifyStored(
  snapshot: StoredSnapshot | null,
): "empty" | "plaintext" | "encrypted" {
  if (!snapshot || snapshot.text === "") return "empty";
  return isEncryptedEnvelope(snapshot.text) ? "encrypted" : "plaintext";
}

function read(storage: PassphraseStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function write(
  storage: PassphraseStorage | null,
  key: string,
  value: string | null,
): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Storage refused (private mode, quota): it holds for the session only.
  }
}

// Passphrases held for the session, by key, shared by every hook instance so
// a remount (or a second consumer) does not lock what the user just opened.
const sessionPassphrases = new Map<string, string>();

export function useEncryption(options: UseEncryptionOptions): Encryption {
  const {
    adapter: inner,
    storageKey,
    policy = "optional",
    remember = "session",
    minLength = PASSPHRASE_MIN_LENGTH,
  } = options;
  // Read through a ref: an app (or a test) may build its storage inline, and a
  // new object each render must not look like a new backend.
  const storageRef = useRef<PassphraseStorage | null>(null);
  storageRef.current =
    options.storage === undefined
      ? typeof localStorage === "undefined"
        ? null
        : localStorage
      : options.storage;

  // A ref-backed logger, so one built inline each render doesn't re-run the
  // backend check or rebuild the adapter.
  const logRef = useRef<Logger>(noopLogger);
  logRef.current = options.logger ?? noopLogger;
  const log = useMemo<Logger>(
    () => ({
      info: (...a) => logRef.current.info(...a),
      warn: (...a) => logRef.current.warn(...a),
      error: (...a) => logRef.current.error(...a),
    }),
    [],
  );

  const modeKey = `${storageKey}:mode`;
  const passKey = options.passphraseKey ?? `${storageKey}:passphrase`;
  const readPass = useCallback(
    (): string | null =>
      remember === "device"
        ? read(storageRef.current, passKey)
        : (sessionPassphrases.get(storageKey) ?? null),
    [remember, passKey, storageKey],
  );

  const [modeOn, setModeOn] = useState(
    () => read(storageRef.current, modeKey) === "encrypted",
  );
  const [passphrase, setPassphrase] = useState<string | null>(readPass);
  const [fromRemote, setFromRemote] = useState(false);
  const [question, setQuestion] = useState<
    "checking" | "setup" | "locked" | "changed" | "unreachable"
  >("checking");
  const [error, setError] = useState<unknown>(null);
  const [checkEpoch, setCheckEpoch] = useState(0);

  // A different key is a different backend: read its own records.
  // Skipped on mount, where the initial state already read them.
  const keyRef = useRef(`${modeKey}|${remember}`);
  useEffect(() => {
    const now = `${modeKey}|${remember}`;
    if (keyRef.current === now) return;
    keyRef.current = now;
    setModeOn(read(storageRef.current, modeKey) === "encrypted");
    setPassphrase(readPass());
    setFromRemote(false);
    setQuestion("checking");
  }, [modeKey, remember, readPass]);

  const passRef = useRef(passphrase);
  passRef.current = passphrase;

  const persistMode = useCallback(
    (on: boolean) => {
      write(storageRef.current, modeKey, on ? "encrypted" : null);
      setModeOn(on);
    },
    [modeKey],
  );
  const persistPass = useCallback(
    (next: string | null) => {
      if (remember === "device") write(storageRef.current, passKey, next);
      else if (next === null) sessionPassphrases.delete(storageKey);
      else sessionPassphrases.set(storageKey, next);
      passRef.current = next;
      setPassphrase(next);
    },
    [remember, passKey, storageKey],
  );

  const encrypted = policy === "required" || modeOn;
  const ready = Boolean(inner && encrypted && passphrase !== null);

  // Encrypted with no passphrase: read the backend to know what to ask. A
  // `changed` verdict survives the check — the reason is the useful part.
  useEffect(() => {
    if (!inner || !encrypted || passphrase !== null) return;
    let cancelled = false;
    setQuestion((q) => (q === "changed" ? q : "checking"));
    setError(null);
    inner.load().then(
      (snap) => {
        if (cancelled) return;
        const kind = classifyStored(snap);
        log.info(`check: backend holds ${kind}`);
        setQuestion((q) =>
          kind === "encrypted" ? (q === "changed" ? q : "locked") : "setup",
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
  }, [inner, encrypted, passphrase, checkEpoch, log]);

  const adapter = useMemo<StorageAdapter | null>(() => {
    if (!inner) return null;
    if (!encrypted) {
      // Off: plaintext passes through, but an envelope on a read means
      // another device turned encryption on. Adopt it and lock.
      const plain = withEncryption(inner, { current: null }, { logger: log });
      return {
        ...plain,
        load: () =>
          plain.load().catch((err: unknown) => {
            if (err instanceof EncryptionLockedError) {
              log.info("adopt: the backend is encrypted — locking");
              setFromRemote(true);
              persistMode(true);
            }
            throw err;
          }),
      };
    }
    if (!ready) return null;
    const sealed = withEncryption(inner, passRef, {
      logger: log,
      sealPlaintext: true,
    });
    // A passphrase that stops opening the backend was changed elsewhere.
    const lockout = (err: unknown): never => {
      if (err instanceof WrongPasswordError) {
        log.warn("the held passphrase no longer opens the backend");
        setQuestion("changed");
        persistPass(null);
      }
      throw err;
    };
    return {
      ...sealed,
      load: () => sealed.load().catch(lockout),
      save: (text, base) => sealed.save(text, base).catch(lockout),
    };
  }, [inner, encrypted, ready, log, persistMode, persistPass]);

  const requireInner = useCallback((): StorageAdapter => {
    if (!inner) throw new Error("No backend connected");
    return inner;
  }, [inner]);

  const checkLength = useCallback(
    (p: string) => {
      if (p.length < minLength) {
        throw new Error(`A passphrase needs at least ${minLength} characters`);
      }
    },
    [minLength],
  );

  const unlock = useCallback(
    async (candidate: string, onProgress?: EncryptionProgress) => {
      if (!candidate) throw new Error("Passphrase is required");
      const backend = requireInner();
      onProgress?.("derivingKey");
      onProgress?.("decrypting");
      // An envelope opens only with its passphrase (WrongPasswordError
      // otherwise); a plaintext or empty backend opens with anything.
      await withEncryption(backend, { current: candidate }).load();
      onProgress?.("finalizing");
      log.info("unlock: passphrase accepted");
      if (policy === "optional") persistMode(true);
      setFromRemote(false);
      persistPass(candidate);
    },
    [requireInner, log, policy, persistMode, persistPass],
  );

  const enable = useCallback(
    async (next: string, onProgress?: EncryptionProgress) => {
      checkLength(next);
      const backend = requireInner();
      onProgress?.("reading");
      const snap = await backend.load();
      // Already sealed (another device got there first): this is an unlock.
      if (classifyStored(snap) === "encrypted") {
        await unlock(next, onProgress);
        return;
      }
      onProgress?.("derivingKey");
      if (snap && snap.text) {
        onProgress?.("encrypting");
        const envelope = await encryptText(snap.text, next);
        onProgress?.("saving");
        await backend.save(envelope, snap.revision);
      }
      onProgress?.("finalizing");
      log.info("enable: encryption on");
      persistMode(true);
      setFromRemote(false);
      persistPass(next);
    },
    [checkLength, requireInner, unlock, log, persistMode, persistPass],
  );

  const disable = useCallback(
    async (onProgress?: EncryptionProgress) => {
      if (policy === "required") {
        throw new Error("Encryption is required for this backend");
      }
      const backend = requireInner();
      const current = passRef.current;
      onProgress?.("reading");
      const raw = await backend.load();
      if (raw && isEncryptedEnvelope(raw.text)) {
        if (!current) throw new Error("Unlock before turning encryption off");
        onProgress?.("derivingKey");
        onProgress?.("decrypting");
        const text = await decryptEnvelope(raw.text, current);
        onProgress?.("saving");
        await backend.save(text, raw.revision);
      }
      onProgress?.("finalizing");
      log.info("disable: encryption off");
      persistMode(false);
      persistPass(null);
    },
    [policy, requireInner, log, persistMode, persistPass],
  );

  const changePassphrase = useCallback(
    async (next: string, onProgress?: EncryptionProgress) => {
      checkLength(next);
      const backend = requireInner();
      const current = passRef.current;
      if (!current) throw new Error("Unlock before changing the passphrase");
      // Offline, the re-seal would reach only a cache while the backend keeps
      // the old envelope. Refuse up front rather than split them.
      if (backend.probe && !(await backend.probe())) {
        throw new TypeError("The backend is unreachable");
      }
      onProgress?.("reading");
      onProgress?.("decrypting");
      const snap = await withEncryption(backend, { current }).load();
      if (snap?.offline) throw new TypeError("The backend is unreachable");
      if (snap) {
        onProgress?.("derivingKey");
        onProgress?.("encrypting");
        const envelope = await encryptText(snap.text, next);
        onProgress?.("saving");
        await backend.save(envelope, snap.revision);
      }
      onProgress?.("finalizing");
      log.info("change: re-sealed under the new passphrase");
      persistPass(next);
    },
    [checkLength, requireInner, log, persistPass],
  );

  const lock = useCallback(() => {
    log.info("lock: passphrase dropped");
    setQuestion("checking");
    persistPass(null);
  }, [log, persistPass]);

  const forget = useCallback(() => {
    log.info("forget: passphrase and mode dropped from this device");
    setQuestion("checking");
    setFromRemote(false);
    persistPass(null);
    persistMode(false);
  }, [log, persistPass, persistMode]);

  const recheck = useCallback(() => setCheckEpoch((n) => n + 1), []);

  const state: EncryptionState =
    !inner || !encrypted ? "off" : ready ? "ready" : question;

  return {
    state,
    policy,
    remember,
    minLength,
    available: inner !== null,
    encrypted,
    locked: state === "locked" || state === "changed",
    fromRemote,
    adapter,
    error,
    enable,
    disable,
    unlock,
    changePassphrase,
    lock,
    forget,
    recheck,
  };
}
