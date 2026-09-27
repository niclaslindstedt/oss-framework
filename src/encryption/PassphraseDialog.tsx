// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "../components/Button.tsx";
import { CipherGlyph } from "../components/CipherGlyph.tsx";
import { Modal } from "../components/Modal.tsx";
import { CloseIcon, LockIcon } from "../components/icons.tsx";
import { isOfflineError } from "../storage/cache/index.ts";

import { WrongPasswordError } from "./errors.ts";
import { resolveEncryptionLabels, type EncryptionLabels } from "./labels.ts";
import {
  PASSPHRASE_MIN_LENGTH,
  type EncryptionProgress,
} from "./useEncryption.ts";

// The one dialog every passphrase question goes through: choosing one,
// entering one, entering the new one after it changed elsewhere, and changing
// it. The modes differ only in copy and in whether the answer is typed twice
// — a passphrase being *chosen* gets a confirm field, because a typo there is
// unrecoverable; one being *checked* does not.
//
// `onSubmit` does the work and may report phases through the progress sink,
// which the dialog flashes beside a `CipherGlyph`. A rejection maps to a
// message: `mapError` first, then a `WrongPasswordError` → the wrong-
// passphrase copy, an offline error → the offline copy, anything else → the
// generic failure.

export type PassphraseDialogMode = "create" | "unlock" | "changed" | "change";

/**
 * @deprecated The 3.7.0 labels, still honoured: `unlockSubmit` is now
 * `unlock` and `working` is `steps`. Use `EncryptionLabels`.
 */
export type PassphraseDialogLabels = EncryptionLabels & {
  unlockSubmit?: string;
  working?: string;
};

type Props = {
  open: boolean;
  mode: PassphraseDialogMode;
  onSubmit: (
    passphrase: string,
    onProgress: EncryptionProgress,
  ) => Promise<void>;
  onClose: () => void;
  /** Named in the copy wherever it says `{location}`. */
  location?: string;
  /** Use the "turned on from another device" copy in `unlock` mode. */
  remote?: boolean;
  mapError?: (err: unknown) => string | null | undefined;
  labels?: PassphraseDialogLabels;
  /** Minimum length for a chosen passphrase. */
  minLength?: number;
};

const INPUT_CLASS =
  "w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg-bright outline-none focus:border-accent";

export function PassphraseDialog({
  open,
  mode,
  onSubmit,
  onClose,
  location = "your storage",
  remote = false,
  mapError,
  labels,
  minLength = PASSPHRASE_MIN_LENGTH,
}: Props) {
  const l = resolveEncryptionLabels(
    labels && {
      ...labels,
      unlock: labels.unlock ?? labels.unlockSubmit,
      steps: labels.working
        ? {
            reading: labels.working,
            derivingKey: labels.working,
            encrypting: labels.working,
            decrypting: labels.working,
            saving: labels.working,
            finalizing: labels.working,
            ...labels.steps,
          }
        : labels.steps,
    },
    location,
  );
  const choosing = mode === "create" || mode === "change";
  const title = {
    create: l.createTitle,
    unlock: l.unlockTitle,
    changed: l.changedTitle,
    change: l.changeTitle,
  }[mode];
  const hint = {
    create: l.createHint,
    unlock: remote ? l.unlockHintRemote : l.unlockHint,
    changed: l.changedHint,
    change: l.changeHint,
  }[mode];
  const submitLabel =
    mode === "create"
      ? l.createSubmit
      : mode === "change"
        ? l.changeSubmit
        : l.unlock;

  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A fresh question every time the dialog opens or changes what it asks.
  useEffect(() => {
    setValue("");
    setConfirm("");
    setError(null);
    setBusy(false);
    setStep(null);
  }, [open, mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !value) return;
    if (choosing) {
      if (value.length < minLength) {
        setError(l.tooShort.replace("{min}", String(minLength)));
        return;
      }
      if (value !== confirm) {
        setError(l.mismatch);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value, (s) => setStep(l.steps[s]));
    } catch (err) {
      setError(
        mapError?.(err) ||
          (err instanceof WrongPasswordError
            ? l.wrong
            : isOfflineError(err)
              ? l.offline
              : l.failed),
      );
      inputRef.current?.focus({ preventScroll: true });
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      labelledBy="passphrase-dialog-title"
      centered
      closeLabel={l.close}
      initialFocusRef={inputRef}
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
          <h2
            id="passphrase-dialog-title"
            className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
          >
            <LockIcon className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 truncate">{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={l.close}
            className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-sm text-fg">{hint}</p>
          {choosing && (
            <p className="text-xs font-medium text-flag">{l.noRecovery}</p>
          )}
          <input
            ref={inputRef}
            type="password"
            autoComplete={choosing ? "new-password" : "current-password"}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            placeholder={l.passphrase}
            aria-label={l.passphrase}
            disabled={busy}
            className={INPUT_CLASS}
          />
          {choosing && (
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onInput={(e) => setConfirm(e.currentTarget.value)}
              placeholder={l.confirm}
              aria-label={l.confirm}
              disabled={busy}
              className={INPUT_CLASS}
            />
          )}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          {busy && (
            <div
              role="status"
              aria-label={l.statusAria}
              className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
            >
              <CipherGlyph className="shrink-0 text-xs text-accent" />
              <span className="truncate text-xs text-muted">
                {step ?? l.steps.derivingKey}
              </span>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {l.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !value}>
            {submitLabel}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
