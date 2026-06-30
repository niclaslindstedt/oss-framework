// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type FormEvent } from "react";

import { CipherGlyph } from "./CipherGlyph.tsx";
import { ClearableInput } from "./ClearableInput.tsx";
import { Button } from "./Button.tsx";
import { ShieldIcon, SpinnerIcon } from "./icons.tsx";

// Full-screen gate shown when at-rest encryption is on but no passphrase is
// held this session (a fresh load, after a reload). The content stays sealed
// until the caller's `onUnlock` resolves with the right passphrase — a lone
// centered card floats on a solid page background.
//
// Unlike a `Modal`, this isn't a dialog over the app: there is nothing to
// reveal behind it (the encrypted content must not render until unlocked), so
// it paints an opaque `bg-page-bg` page with no dimmed backdrop and no
// header/footer chrome. While `onUnlock` runs it animates a `CipherGlyph`
// beside whatever phase label the caller pushes through `onProgress`, so the
// wait reads as bytes being deciphered rather than a blank spinner.
//
// Domain-neutral by construction: every visible string injects through
// `labels` (English defaults), the phase line is a caller-supplied string, and
// a rejected `onUnlock` maps to a message through `mapError` (defaulting to the
// generic "wrong passphrase" copy) — so the app owns its own vocabulary and
// the framework owns the lock/unlock plumbing.

/** Visible strings the gate needs. All optional — English defaults fill in
 *  any you omit. */
export type UnlockGateLabels = {
  /** Heading next to the shield. Default `"Content is locked"`. */
  title?: string;
  /** Sub-text under the heading. Default
   *  `"Enter your passphrase to unlock and read your content on this device."`. */
  hint?: string;
  /** Passphrase input placeholder and accessible label. Default `"Passphrase"`. */
  passphrase?: string;
  /** Text on the unlock button. Default `"Unlock"`. */
  unlock?: string;
  /** Shown when `onUnlock` rejects and `mapError` returns nothing. Default
   *  `"Wrong passphrase. Try again."`. */
  error?: string;
  /** Accessible label for the live progress region. Default `"Decrypting"`. */
  statusAria?: string;
  /** Accessible label for the input's clear button. Default `"Clear"`. */
  clear?: string;
};

type Props = {
  open: boolean;
  /**
   * Resolves on success, rejects on the wrong passphrase. The second argument
   * is a progress sink — call it with a phase label (e.g. "Checking your
   * passphrase…") and the gate flashes it beside the cipher animation.
   */
  onUnlock: (
    password: string,
    onProgress: (label: string) => void,
  ) => Promise<void>;
  /**
   * Translate a rejected `onUnlock` into the message the gate shows. Return a
   * falsy value to fall back to `labels.error`. Defaults to that fallback — use
   * it to distinguish, say, an offline backend from a genuinely wrong
   * passphrase.
   */
  mapError?: (err: unknown) => string | null | undefined;
  labels?: UnlockGateLabels;
};

export function UnlockGate({ open, onUnlock, mapError, labels }: Props) {
  const title = labels?.title ?? "Content is locked";
  const hint =
    labels?.hint ??
    "Enter your passphrase to unlock and read your content on this device.";
  const passphraseLabel = labels?.passphrase ?? "Passphrase";
  const unlockLabel = labels?.unlock ?? "Unlock";
  const errorLabel = labels?.error ?? "Wrong passphrase. Try again.";
  const statusAria = labels?.statusAria ?? "Decrypting";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The phase line the unlock flow reports while it derives the key and
  // deciphers — caller-supplied, so the gate hints at progress instead of
  // sitting blank.
  const [step, setStep] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    // `preventScroll` so focusing the field doesn't jerk the page.
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    setStep(null);
    try {
      await onUnlock(password, setStep);
      setPassword("");
    } catch (err) {
      setError((mapError?.(err) || errorLabel) ?? errorLabel);
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-page-bg px-4">
      <form
        onSubmit={submit}
        aria-labelledby="unlock-gate-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-line bg-surface p-5"
      >
        <div className="flex items-center gap-2 text-accent">
          <ShieldIcon className="h-6 w-6" />
          <h1
            id="unlock-gate-title"
            className="text-base font-bold text-fg-bright"
          >
            {title}
          </h1>
        </div>
        <p className="text-sm text-muted">{hint}</p>
        <ClearableInput
          ref={inputRef}
          type="password"
          value={password}
          onValueChange={setPassword}
          placeholder={passphraseLabel}
          aria-label={passphraseLabel}
          clearLabel={labels?.clear ?? "Clear"}
          wrapperClassName="rounded-md border border-line bg-surface-2 px-2 py-1.5 focus-within:border-accent"
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!password || busy}
          className="flex w-full items-center justify-center gap-2"
        >
          {busy && <SpinnerIcon className="h-4 w-4" />}
          {unlockLabel}
        </Button>
        {busy && step && (
          <div
            role="status"
            aria-label={statusAria}
            className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
          >
            <CipherGlyph className="shrink-0 text-xs text-accent" />
            <span className="truncate text-xs text-muted">{step}</span>
          </div>
        )}
      </form>
    </div>
  );
}
