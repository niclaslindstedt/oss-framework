// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A small generic confirmation dialog — the in-app replacement for the
// browser's `window.confirm`. Title + optional description + a Confirm and a
// Cancel button, rendered as a compact centered card over the framework
// `Modal`. Dependency-free: the title glyph and the in-button spinner come
// from the framework's own inline icon set.
//
// Tapping Confirm paints a spinner inside the button before running
// `onConfirm`: a heavy handler (deleting a record and its whole document) can
// block paint long enough that the tap feels lost, so a two-frame defer lets
// the browser show the spinner first. The dialog blocks further dismissal
// while the confirm is in flight so the user can't double-fire it.

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "./Button.tsx";
import {
  AlertTriangleIcon,
  CloseIcon,
  HelpCircleIcon,
  SpinnerIcon,
} from "./icons.tsx";
import { Modal } from "./Modal.tsx";

/** `danger` paints the confirm button red and swaps the neutral
 *  question-mark title glyph for a warning triangle. */
export type ConfirmTone = "default" | "danger";

/** Visible strings the dialog needs. All optional — English defaults are
 *  used for any you omit. */
export type ConfirmDialogLabels = {
  /** Accessible label for the header's close (✕) button. Default `"Close"`. */
  close?: string;
  /** Text on the cancel button. Default `"Cancel"`. */
  cancel?: string;
};

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Text on the confirm button (e.g. `"Delete"`). */
  confirmLabel: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  labels?: ConfirmDialogLabels;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  onConfirm,
  onCancel,
  labels,
}: Props) {
  const closeLabel = labels?.close ?? "Close";
  const cancelLabel = labels?.cancel ?? "Cancel";
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  const runConfirm = () => {
    if (pending) return;
    setPending(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => void onConfirm());
    });
  };

  const handleCancel = () => {
    if (pending) return;
    onCancel();
  };

  const danger = tone === "danger";

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      labelledBy="confirm-dialog-title"
      role="alertdialog"
      centered
      closeLabel={closeLabel}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="confirm-dialog-title"
          className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <span
            className={`shrink-0 ${danger ? "text-danger" : "text-accent"}`}
          >
            {danger ? (
              <AlertTriangleIcon className="h-4 w-4" />
            ) : (
              <HelpCircleIcon className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          aria-label={closeLabel}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {description && <div className="text-sm text-fg">{description}</div>}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={pending}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? "danger" : "primary"}
          onClick={runConfirm}
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex items-center gap-2"
        >
          <span>{confirmLabel}</span>
          {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
        </Button>
      </footer>
    </Modal>
  );
}
