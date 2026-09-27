// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { UnlockGate } from "../components/UnlockGate.tsx";
import { LockIcon } from "../components/icons.tsx";

import type { PinLock } from "./usePinLock.ts";

// The PIN gate: `UnlockGate` with a numeric keypad, a lock, and PIN copy, wired
// to `usePinLock`. `AppLock` is the one-liner around an app shell — it renders
// the gate instead of its children while locked, so nothing behind the PIN
// paints, not even a modal portalled to the body.

export type PinGateLabels = {
  /** Default `"Locked"`. */
  title?: string;
  /** Default `"Enter your PIN to open the app."`. */
  hint?: string;
  /** Input placeholder and label. Default `"PIN"`. */
  pin?: string;
  /** Default `"Open"`. */
  submit?: string;
  /** Default `"Wrong PIN. Try again."`. */
  wrong?: string;
  /** The input's clear button. Default `"Clear"`. */
  clear?: string;
};

export function PinGate({
  pin,
  labels = {},
}: {
  pin: PinLock;
  labels?: PinGateLabels;
}) {
  return (
    <UnlockGate
      open={pin.locked}
      inputMode="numeric"
      icon={<LockIcon className="h-6 w-6" />}
      onUnlock={async (code) => {
        if (!(await pin.unlock(code))) throw new Error("Wrong PIN");
      }}
      labels={{
        title: labels.title ?? "Locked",
        hint: labels.hint ?? "Enter your PIN to open the app.",
        passphrase: labels.pin ?? "PIN",
        unlock: labels.submit ?? "Open",
        error: labels.wrong ?? "Wrong PIN. Try again.",
        clear: labels.clear,
      }}
    />
  );
}

export function AppLock({
  pin,
  labels,
  children,
}: {
  pin: PinLock;
  labels?: PinGateLabels;
  children: ReactNode;
}) {
  if (pin.locked) return <PinGate pin={pin} labels={labels} />;
  return <>{children}</>;
}
