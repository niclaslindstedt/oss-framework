// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type FormEvent } from "react";

import { Button } from "../components/Button.tsx";
import { LockIcon } from "../components/icons.tsx";

import { PIN_MIN_LENGTH } from "./pin.ts";
import type { PinLock } from "./usePinLock.ts";

// The settings control for an app lock: whether a PIN is set, and the forms
// to set, change or remove one. It renders no card of its own — place it in
// whatever settings section the app has — and the two lines of copy it shows
// by default are the ones that keep a PIN from being mistaken for encryption.

export type PinLockControlLabels = {
  on?: string;
  off?: string;
  hint?: string;
  /** The honest line about what a PIN does not protect. */
  softWarning?: string;
  set?: string;
  change?: string;
  remove?: string;
  pin?: string;
  confirm?: string;
  current?: string;
  save?: string;
  cancel?: string;
  /** `{min}` is replaced with the minimum length. */
  tooShort?: string;
  mismatch?: string;
  wrong?: string;
};

type Props = {
  pin: PinLock;
  labels?: PinLockControlLabels;
  /** Disable every control (e.g. while a demo has taken over the app). */
  disabled?: boolean;
};

const INPUT_CLASS =
  "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

export function PinLockControl({ pin, labels = {}, disabled }: Props) {
  const [editing, setEditing] = useState<"set" | "remove" | null>(null);
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditing(null);
    setCurrent("");
    setCode("");
    setConfirm("");
    setError(null);
  };

  const wrong = labels.wrong ?? "Wrong PIN.";

  const submitSet = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (code.length < PIN_MIN_LENGTH) {
      setError(
        (labels.tooShort ?? "Use at least {min} digits.").replace(
          "{min}",
          String(PIN_MIN_LENGTH),
        ),
      );
      return;
    }
    if (code !== confirm) {
      setError(labels.mismatch ?? "The two PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await pin.setPin(code, current)) reset();
      else setError(wrong);
    } finally {
      setBusy(false);
    }
  };

  const submitRemove = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await pin.clearPin(current)) reset();
      else setError(wrong);
    } finally {
      setBusy(false);
    }
  };

  const codeInput = (
    value: string,
    onValue: (next: string) => void,
    label: string,
  ) => (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onInput={(e) => onValue(e.currentTarget.value)}
      aria-label={label}
      placeholder={label}
      className={INPUT_CLASS}
    />
  );

  const currentLabel = labels.current ?? "Current PIN";
  const errorLine = error && (
    <p role="alert" className="text-xs text-danger">
      {error}
    </p>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <LockIcon
          className={`mt-0.5 h-5 w-5 shrink-0 ${pin.hasPin ? "text-accent" : "text-muted"}`}
        />
        <div className="flex-1">
          <p className="text-sm font-bold text-fg-bright">
            {pin.hasPin
              ? (labels.on ?? "A PIN is asked for on this device")
              : (labels.off ?? "No PIN on this device")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {labels.hint ??
              "A code asked for when the app opens, and again after it has been in the background for a while."}
          </p>
          <p className="mt-1 text-xs text-muted">
            {labels.softWarning ??
              "A PIN keeps a borrowed phone out. It does not encrypt anything on this device."}
          </p>
        </div>
      </div>

      {editing === null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setEditing("set")}
            disabled={disabled}
          >
            {pin.hasPin
              ? (labels.change ?? "Change PIN")
              : (labels.set ?? "Set a PIN")}
          </Button>
          {pin.hasPin && (
            <Button
              variant="secondary"
              onClick={() => setEditing("remove")}
              disabled={disabled}
            >
              {labels.remove ?? "Remove PIN"}
            </Button>
          )}
        </div>
      )}

      {editing === "set" && (
        <form
          onSubmit={(e) => void submitSet(e)}
          className="flex flex-col gap-2"
        >
          {pin.hasPin && codeInput(current, setCurrent, currentLabel)}
          {codeInput(code, setCode, labels.pin ?? "New PIN")}
          {codeInput(confirm, setConfirm, labels.confirm ?? "Repeat the PIN")}
          {errorLine}
          <div className="flex items-center gap-2">
            <Button variant="primary" type="submit" disabled={busy}>
              {labels.save ?? "Save"}
            </Button>
            <Button variant="secondary" onClick={reset} disabled={busy}>
              {labels.cancel ?? "Cancel"}
            </Button>
          </div>
        </form>
      )}

      {editing === "remove" && (
        <form
          onSubmit={(e) => void submitRemove(e)}
          className="flex flex-col gap-2"
        >
          {codeInput(current, setCurrent, currentLabel)}
          {errorLine}
          <div className="flex items-center gap-2">
            <Button variant="danger" type="submit" disabled={busy}>
              {labels.remove ?? "Remove PIN"}
            </Button>
            <Button variant="secondary" onClick={reset} disabled={busy}>
              {labels.cancel ?? "Cancel"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
