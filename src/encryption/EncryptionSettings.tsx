// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { Button } from "../components/Button.tsx";
import { CipherGlyph } from "../components/CipherGlyph.tsx";
import { ShieldIcon } from "../components/icons.tsx";

import { resolveEncryptionLabels, type EncryptionLabels } from "./labels.ts";
import {
  PassphraseDialog,
  type PassphraseDialogMode,
} from "./PassphraseDialog.tsx";
import type { Encryption } from "./useEncryption.ts";

// The settings block for `useEncryption`: what the state is, in one line, and
// the one or two things that can be done about it — turn it on, turn it off,
// unlock, change the passphrase, lock now, try again. Every passphrase it asks
// for goes through `PassphraseDialog`; turning encryption off runs inline with
// its phases on a `CipherGlyph` line, the way notes' storage settings do.
//
// It renders no card of its own — drop it into whatever settings section the
// app has — and nothing at all while no backend is connected.

type Props = {
  encryption: Encryption;
  /** Named in the copy wherever it says `{location}`. */
  location?: string;
  labels?: EncryptionLabels;
  /** Disable every control (e.g. while a demo has taken over storage). */
  disabled?: boolean;
  /** Called after a passphrase change lands — to re-read, or say so. */
  onChanged?: () => void;
  mapError?: (err: unknown) => string | null | undefined;
};

export function EncryptionSettings({
  encryption: enc,
  location = "your storage",
  labels,
  disabled = false,
  onChanged,
  mapError,
}: Props) {
  const l = resolveEncryptionLabels(labels, location);
  const [dialog, setDialog] = useState<PassphraseDialogMode | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!enc.available) return null;

  const busy = step !== null;
  const { state } = enc;
  const on = state === "ready";

  const turnOff = async () => {
    setError(null);
    setStep(l.steps.reading);
    try {
      await enc.disable((s) => setStep(l.steps[s]));
    } catch (err) {
      setError(
        mapError?.(err) || (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setStep(null);
    }
  };

  const status =
    state === "ready"
      ? enc.remember === "device"
        ? l.rememberedHint
        : l.sessionHint
      : state === "checking"
        ? l.checking
        : state === "setup"
          ? l.setupNeeded
          : state === "locked"
            ? l.lockedStatus
            : state === "changed"
              ? l.changedStatus
              : state === "unreachable"
                ? l.unreachable
                : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <ShieldIcon
          className={`mt-0.5 h-5 w-5 shrink-0 ${on ? "text-accent" : "text-muted"}`}
        />
        <div className="flex-1">
          <p className="text-sm font-bold text-fg-bright">
            {enc.encrypted ? l.on : l.off}
          </p>
          <p className="mt-1 text-xs text-muted">
            {enc.policy === "required" ? l.requiredHint : l.hint}
          </p>
          {status && (
            <p className="mt-1 text-xs font-medium text-fg">{status}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {state === "off" && (
          <Button
            variant="primary"
            onClick={() => setDialog("create")}
            disabled={disabled || busy}
          >
            {l.enable}
          </Button>
        )}
        {state === "setup" && (
          <Button
            variant="primary"
            onClick={() => setDialog("create")}
            disabled={disabled}
          >
            {l.setPassphrase}
          </Button>
        )}
        {(state === "locked" || state === "changed") && (
          <Button
            variant="primary"
            onClick={() => setDialog(state === "locked" ? "unlock" : "changed")}
            disabled={disabled}
          >
            {l.unlock}
          </Button>
        )}
        {state === "unreachable" && (
          <Button onClick={enc.recheck} disabled={disabled}>
            {l.retry}
          </Button>
        )}
        {on && (
          <Button
            onClick={() => setDialog("change")}
            disabled={disabled || busy}
          >
            {l.changePassphrase}
          </Button>
        )}
        {on && enc.remember === "session" && (
          <Button onClick={enc.lock} disabled={disabled || busy}>
            {l.lock}
          </Button>
        )}
        {enc.encrypted && enc.policy === "optional" && (
          <Button
            variant="danger"
            onClick={() => (on ? void turnOff() : setError(l.unlockFirst))}
            disabled={disabled || busy}
          >
            {l.disable}
          </Button>
        )}
      </div>

      {busy && (
        <div
          role="status"
          aria-label={l.statusAria}
          className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
        >
          <CipherGlyph className="shrink-0 text-xs text-accent" />
          <span className="truncate text-xs text-muted">{step}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <PassphraseDialog
        open={dialog !== null}
        mode={dialog ?? "create"}
        location={location}
        remote={enc.fromRemote}
        labels={labels}
        mapError={mapError}
        minLength={enc.minLength}
        onClose={() => setDialog(null)}
        onSubmit={async (p, onProgress) => {
          if (dialog === "create") await enc.enable(p, onProgress);
          else if (dialog === "change") {
            await enc.changePassphrase(p, onProgress);
            onChanged?.();
          } else await enc.unlock(p, onProgress);
          setError(null);
          setDialog(null);
        }}
      />
    </div>
  );
}
