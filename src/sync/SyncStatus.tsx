// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactElement } from "react";

import {
  CloudAlertIcon,
  CloudCheckIcon,
  CloudOffIcon,
  CloudUploadIcon,
  SpinnerIcon,
  type IconProps,
} from "../components/icons.tsx";
import { DEFAULT_SYNC_STATUS_LABELS, type SyncStatusLabels } from "./labels.ts";
import type { SaveStatus } from "./types.ts";

// A single header affordance for a backed-up document. One glyph that morphs
// with the sync state: a cloud-upload (accent ring) when there are unsaved
// edits to push, a spinner while a save is in flight, a green cloud-check when
// the backend is in sync, and a coloured cloud-alert for conflict / auth /
// throttle / generic errors. Whatever the state — including mid-save — tapping
// it opens the details modal, the command centre where the status is spelled
// out and Save now / Reconnect / Reload live. A single, predictable way in: the
// glyph never does double-duty as a save button (the "why won't it tap?" trap)
// and is never disabled.

type Props = {
  /** The backend's display name, woven into the "Synced to …" label. */
  providerName: string;
  status: SaveStatus;
  /** True when there are local edits not yet pushed to the backend. */
  dirty: boolean;
  /** True when the backend is unreachable and we're on the on-device copy. */
  offline: boolean;
  onOpenDetails: () => void;
  labels?: Partial<SyncStatusLabels>;
  /** Extra classes merged onto the button (size / margin tweaks). */
  className?: string;
};

type IconComponent = (props: IconProps) => ReactElement;

type Tone = "ok" | "busy" | "warn" | "err" | "accent" | "flag";

type View = {
  Icon: IconComponent;
  label: string;
  tone: Tone;
  spin?: boolean;
};

function viewFor(
  status: SaveStatus,
  dirty: boolean,
  offline: boolean,
  providerName: string,
  labels: SyncStatusLabels,
): View {
  // Offline takes precedence: a stale local copy must never read as "synced".
  // The other states (conflict, auth-error) need a live backend response to
  // arise, so they can't co-occur with being offline.
  if (offline) {
    return { Icon: CloudOffIcon, label: labels.offline, tone: "flag" };
  }
  switch (status) {
    case "saving":
      return {
        Icon: SpinnerIcon,
        label: labels.saving,
        tone: "busy",
        spin: true,
      };
    case "error":
      return { Icon: CloudAlertIcon, label: labels.failed, tone: "err" };
    case "throttled":
      return { Icon: CloudAlertIcon, label: labels.throttled, tone: "flag" };
    case "auth-error":
      return {
        Icon: CloudAlertIcon,
        label: labels.reauthRequired,
        tone: "warn",
      };
    case "conflict":
      return { Icon: CloudAlertIcon, label: labels.syncConflict, tone: "warn" };
    case "saved":
    case "idle":
      return dirty
        ? { Icon: CloudUploadIcon, label: labels.saveUnsaved, tone: "accent" }
        : {
            Icon: CloudCheckIcon,
            label: labels.syncedTo(providerName),
            tone: "ok",
          };
  }
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-success/40 text-success hover:bg-success/10",
  busy: "border-line text-muted hover:bg-surface-2",
  warn: "border-pipe/50 text-pipe hover:bg-pipe/10",
  err: "border-danger/50 text-danger hover:bg-danger/10",
  accent: "border-accent bg-accent/15 text-accent hover:bg-accent/25",
  flag: "border-flag/50 text-flag hover:bg-flag/10",
};

export function SyncStatus({
  providerName,
  status,
  dirty,
  offline,
  onOpenDetails,
  labels,
  className = "",
}: Props) {
  const merged = { ...DEFAULT_SYNC_STATUS_LABELS, ...labels };
  const view = viewFor(status, dirty, offline, providerName, merged);
  const busy = status === "saving";
  return (
    <button
      type="button"
      onClick={onOpenDetails}
      title={view.label}
      aria-label={view.label}
      aria-busy={busy || undefined}
      className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-transparent focus-visible:ring-2 focus-visible:ring-fg focus-visible:outline-none ${TONE_CLASS[view.tone]} ${className}`}
    >
      <view.Icon
        className={`h-[18px] w-[18px] ${view.spin ? "animate-spin" : ""}`}
      />
    </button>
  );
}
