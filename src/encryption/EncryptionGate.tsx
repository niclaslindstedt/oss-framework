// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import { UnlockGate } from "../components/UnlockGate.tsx";
import { isOfflineError } from "../storage/cache/index.ts";

import { WrongPasswordError } from "./errors.ts";
import { resolveEncryptionLabels, type EncryptionLabels } from "./labels.ts";
import {
  PassphraseDialog,
  type PassphraseDialogMode,
} from "./PassphraseDialog.tsx";
import type { Encryption } from "./useEncryption.ts";

// Asks the passphrase question whenever `useEncryption` needs an answer —
// mount it once, beside the app shell, and forget about it.
//
//   - `setup`   → "Choose a passphrase" (typed twice)
//   - `locked`  → "Enter your passphrase" (or the turned-on-elsewhere copy)
//   - `changed` → "The passphrase has changed"
//
// Two presentations. By default a dismissable dialog over the app: right
// when the app still works behind it (its working copy is on the device and
// only sync waits). With `blocking`, a locked state is the full-screen
// `UnlockGate` instead, with nothing behind it: right when the encrypted
// document *is* the app, and there is nothing to show until it opens.

type Props = {
  encryption: Encryption;
  /** Named in the copy wherever it says `{location}`. */
  location?: string;
  labels?: EncryptionLabels;
  /** Full-screen gate for `locked` / `changed` instead of a dialog. */
  blocking?: boolean;
  /** Ask nothing while true (a demo has taken over storage, say). */
  paused?: boolean;
  mapError?: (err: unknown) => string | null | undefined;
};

const MODE: Partial<Record<Encryption["state"], PassphraseDialogMode>> = {
  setup: "create",
  locked: "unlock",
  changed: "changed",
};

export function EncryptionGate({
  encryption,
  location = "your storage",
  labels,
  blocking = false,
  paused = false,
  mapError,
}: Props) {
  const mode = paused ? undefined : MODE[encryption.state];
  // Put off with Cancel until the question changes; settings can still ask.
  const [dismissed, setDismissed] = useState<PassphraseDialogMode | null>(null);
  useEffect(() => {
    if (dismissed !== null && mode !== dismissed) setDismissed(null);
  }, [mode, dismissed]);

  if (!mode) return null;

  if (blocking && mode !== "create") {
    const l = resolveEncryptionLabels(labels, location);
    return (
      <UnlockGate
        open
        onUnlock={(p, onProgress) =>
          encryption.unlock(p, (s) => onProgress(l.steps[s]))
        }
        mapError={(err) =>
          mapError?.(err) ||
          (err instanceof WrongPasswordError
            ? l.wrong
            : isOfflineError(err)
              ? l.offline
              : l.failed)
        }
        labels={{
          title: mode === "changed" ? l.changedTitle : l.unlockTitle,
          hint:
            mode === "changed"
              ? l.changedHint
              : encryption.fromRemote
                ? l.unlockHintRemote
                : l.unlockHint,
          passphrase: l.passphrase,
          unlock: l.unlock,
          error: l.wrong,
          statusAria: l.statusAria,
          clear: l.close,
        }}
      />
    );
  }

  return (
    <PassphraseDialog
      open={dismissed !== mode}
      mode={mode}
      location={location}
      remote={encryption.fromRemote}
      labels={labels}
      mapError={mapError}
      minLength={encryption.minLength}
      onClose={() => setDismissed(mode)}
      onSubmit={(p, onProgress) =>
        mode === "create"
          ? encryption.enable(p, onProgress)
          : encryption.unlock(p, onProgress)
      }
    />
  );
}
