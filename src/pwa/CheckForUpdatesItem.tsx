// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloudOffIcon,
  RefreshIcon,
  SparklesIcon,
  SpinnerIcon,
} from "../components/icons.tsx";
import type { PwaUpdateCheckResult } from "./usePwaUpdate.ts";

// A "check for updates" row for a side-menu / settings footer. The framework's
// `usePwaUpdate` already checks hourly and on tab focus; this gives the user an
// explicit "check now" affordance and, just as important, owns all the generic
// chrome that affordance needs — a spinner while the probe runs, a brief
// "you're up to date" reassurance when nothing is found, an "update available"
// nudge once a build is waiting, and the `aria-live` plumbing that announces
// each transition. Every adopter would otherwise hand-roll the same row, so the
// component owns it: feed it `usePwaUpdate`'s state and it renders the lot.
//
// Presentational on purpose, mirroring `UpdateToast`: it takes the `checking`
// flag, the `needRefresh` flag, and the `checkForUpdate` callback as props
// rather than calling `usePwaUpdate` itself, so a host that already drives the
// toast from the singleton wires this from the same call. Drive it with:
//
//   const u = usePwaUpdate({ base, cacheId });
//   <CheckForUpdatesItem
//     checking={u.checking}
//     updateAvailable={u.needRefresh}
//     onCheck={u.checkForUpdate}
//   />
//
// A found update surfaces through `UpdateToast` as usual — this row's job is to
// trigger the probe and report the result, not to render the prompt.

export type CheckForUpdatesLabels = {
  // Resting label: tap to check.
  idle: string;
  // While the probe runs.
  checking: string;
  // The running build is already newest (lingers briefly, then resets).
  upToDate: string;
  // A build is downloaded and waiting — tap re-surfaces the prompt.
  updateAvailable: string;
  // No service worker to check (dev build / unsupported browser).
  unavailable: string;
};

export const DEFAULT_CHECK_FOR_UPDATES_LABELS: CheckForUpdatesLabels = {
  idle: "Check for updates",
  checking: "Checking for updates…",
  upToDate: "You’re up to date",
  updateAvailable: "Update available",
  unavailable: "Updates unavailable",
};

// How long the transient "up to date" / "unavailable" result lingers before
// the row settles back to its resting state.
const RESULT_LINGER_MS = 4000;

export type CheckForUpdatesItemProps = {
  // True while a manual check runs — the row shows a spinner and is disabled.
  // Wire from `usePwaUpdate().checking`.
  checking: boolean;
  // True once a build is installed and waiting. The row reads "Update
  // available" and a tap re-surfaces the prompt. Wire from
  // `usePwaUpdate().needRefresh`.
  updateAvailable: boolean;
  // Run the check; resolves with the outcome. Wire from
  // `usePwaUpdate().checkForUpdate`.
  onCheck: () => Promise<PwaUpdateCheckResult>;
  // Override any of the visible strings (English by default).
  labels?: Partial<CheckForUpdatesLabels>;
  // Appended to the row's classes — match your footer's geometry / colours.
  className?: string;
};

// Footer-row geometry shared with the other menu rows: full width, an icon
// gutter, the density vertical padding, a muted resting tone that brightens on
// hover. Themed via the same CSS variables the rest of the menu uses.
const ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-fg";

// The transient outcome the row last showed, distinct from the live props:
// "checking" is reflected from the prop, the rest are local echoes that fade.
type Echo = "idle" | "up-to-date" | "unavailable";

export function CheckForUpdatesItem({
  checking,
  updateAvailable,
  onCheck,
  labels,
  className,
}: CheckForUpdatesItemProps) {
  const l = { ...DEFAULT_CHECK_FOR_UPDATES_LABELS, ...labels };
  const [echo, setEcho] = useState<Echo>("idle");
  // Guard a state update from a check that resolves after unmount.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Let a transient result fade back to the resting label on its own.
  useEffect(() => {
    if (echo === "idle") return;
    const id = window.setTimeout(() => setEcho("idle"), RESULT_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [echo]);

  async function handleClick() {
    if (checking) return;
    setEcho("idle");
    const result = await onCheck();
    if (!alive.current) return;
    // A find raises the prompt (and flips `updateAvailable`) — nothing to echo.
    setEcho(result === "update-found" ? "idle" : result);
  }

  // Priority: an in-flight check, then a waiting build, then a fading result,
  // then rest. `aria-live` announces each as it lands.
  const { icon, label } = checking
    ? {
        icon: <SpinnerIcon className="h-5 w-5 animate-spin" />,
        label: l.checking,
      }
    : updateAvailable
      ? {
          icon: <SparklesIcon className="h-5 w-5 text-accent" />,
          label: l.updateAvailable,
        }
      : echo === "up-to-date"
        ? {
            icon: <CheckIcon className="h-5 w-5 text-success" />,
            label: l.upToDate,
          }
        : echo === "unavailable"
          ? { icon: <CloudOffIcon className="h-5 w-5" />, label: l.unavailable }
          : { icon: <RefreshIcon className="h-5 w-5" />, label: l.idle };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => void handleClick()}
      disabled={checking}
      aria-busy={checking}
      className={className ? `${ROW_CLASS} ${className}` : ROW_CLASS}
    >
      <span className={updateAvailable ? "text-accent" : "text-muted"}>
        {icon}
      </span>
      <span className="flex-1" aria-live="polite">
        {label}
      </span>
    </button>
  );
}
