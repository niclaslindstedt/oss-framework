// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "../components/Button.tsx";
import { CipherGlyph } from "../components/CipherGlyph.tsx";
import { Modal } from "../components/Modal.tsx";
import { CloseIcon, LockIcon } from "../components/icons.tsx";

import { WrongPasswordError } from "./errors.ts";
import { PASSPHRASE_MIN_LENGTH } from "./useRequiredEncryption.ts";

// The one dialog every passphrase question goes through: choosing one for a
// backend that holds nothing sealed yet, entering the one another device
// chose, entering the new one after it changed elsewhere, and changing it
// from settings. The modes differ only in copy and in whether the answer is
// typed twice — a passphrase that is being *chosen* gets a confirm field,
// because a typo there is unrecoverable; one being *checked* does not.
//
// Every visible string injects through `labels` (English defaults), so the
// app owns its vocabulary. `onSubmit` does the work; a rejection maps to a
// message through `mapError`, falling back to the wrong-passphrase copy for
// a `WrongPasswordError` and a generic one for anything else.

export type PassphraseDialogMode = "create" | "unlock" | "changed" | "change";

export type PassphraseDialogLabels = {
  /** Heading per mode. */
  createTitle?: string;
  unlockTitle?: string;
  changedTitle?: string;
  changeTitle?: string;
  /** Body copy per mode. */
  createHint?: string;
  unlockHint?: string;
  changedHint?: string;
  changeHint?: string;
  /** The one line that must not be skipped when a passphrase is chosen. */
  noRecovery?: string;
  passphrase?: string;
  confirm?: string;
  /** Submit button per mode. */
  createSubmit?: string;
  unlockSubmit?: string;
  changeSubmit?: string;
  cancel?: string;
  close?: string;
  /** `{min}` is replaced with the minimum length. */
  tooShort?: string;
  mismatch?: string;
  wrong?: string;
  failed?: string;
  /** The status line while the key is derived. */
  working?: string;
};

type Props = {
  open: boolean;
  mode: PassphraseDialogMode;
  onSubmit: (passphrase: string) => Promise<void>;
  onClose: () => void;
  mapError?: (err: unknown) => string | null | undefined;
  labels?: PassphraseDialogLabels;
  /** Minimum length for a chosen passphrase. Defaults to {@link PASSPHRASE_MIN_LENGTH}. */
  minLength?: number;
};

const INPUT_CLASS =
  "w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg-bright outline-none focus:border-accent";

export function PassphraseDialog({
  open,
  mode,
  onSubmit,
  onClose,
  mapError,
  labels = {},
  minLength = PASSPHRASE_MIN_LENGTH,
}: Props) {
  const choosing = mode === "create" || mode === "change";
  const title =
    mode === "create"
      ? (labels.createTitle ?? "Choose a passphrase")
      : mode === "unlock"
        ? (labels.unlockTitle ?? "Enter your passphrase")
        : mode === "changed"
          ? (labels.changedTitle ?? "The passphrase has changed")
          : (labels.changeTitle ?? "Change passphrase");
  const hint =
    mode === "create"
      ? (labels.createHint ??
        "Everything stored here is encrypted on this device before it leaves. Choose a passphrase to seal it with — every device that opens this copy will need it.")
      : mode === "unlock"
        ? (labels.unlockHint ??
          "This copy is encrypted. Enter the passphrase it was sealed with on your other device.")
        : mode === "changed"
          ? (labels.changedHint ??
            "The passphrase was changed on another device. Enter the new one to keep syncing.")
          : (labels.changeHint ??
            "The copy is re-sealed under the new passphrase. Your other devices will ask for it on their next sync.");
  const submitLabel =
    mode === "create"
      ? (labels.createSubmit ?? "Encrypt")
      : mode === "change"
        ? (labels.changeSubmit ?? "Change")
        : (labels.unlockSubmit ?? "Unlock");

  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A fresh question every time the dialog opens or changes what it asks.
  useEffect(() => {
    setValue("");
    setConfirm("");
    setError(null);
    setBusy(false);
  }, [open, mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !value) return;
    if (choosing) {
      if (value.length < minLength) {
        setError(
          (labels.tooShort ?? "Use at least {min} characters.").replace(
            "{min}",
            String(minLength),
          ),
        );
        return;
      }
      if (value !== confirm) {
        setError(labels.mismatch ?? "The two passphrases don't match.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(
        mapError?.(err) ||
          (err instanceof WrongPasswordError
            ? (labels.wrong ?? "Wrong passphrase. Try again.")
            : (labels.failed ?? "That didn't work. Try again.")),
      );
      inputRef.current?.focus({ preventScroll: true });
    } finally {
      setBusy(false);
    }
  };

  const closeLabel = labels.close ?? "Close";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      labelledBy="passphrase-dialog-title"
      centered
      closeLabel={closeLabel}
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
            aria-label={closeLabel}
            className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-sm text-fg">{hint}</p>
          {choosing && (
            <p className="text-xs font-medium text-flag">
              {labels.noRecovery ??
                "There is no way to recover a forgotten passphrase — not by us, not by the storage provider. Write it down somewhere safe."}
            </p>
          )}
          <input
            ref={inputRef}
            type="password"
            autoComplete={choosing ? "new-password" : "current-password"}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            placeholder={labels.passphrase ?? "Passphrase"}
            aria-label={labels.passphrase ?? "Passphrase"}
            className={INPUT_CLASS}
          />
          {choosing && (
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onInput={(e) => setConfirm(e.currentTarget.value)}
              placeholder={labels.confirm ?? "Repeat the passphrase"}
              aria-label={labels.confirm ?? "Repeat the passphrase"}
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
              className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
            >
              <CipherGlyph className="shrink-0 text-xs text-accent" />
              <span className="truncate text-xs text-muted">
                {labels.working ?? "Working on the encryption…"}
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
            {labels.cancel ?? "Cancel"}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !value}>
            {submitLabel}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
