// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PullToRefreshState } from "../hooks/usePullToRefresh.ts";
import { ArrowDownIcon, SpinnerIcon } from "./icons.tsx";

// Slide-down pill that surfaces the pull-to-refresh gesture driven by
// `usePullToRefresh`. Pinned to the top edge of the visible viewport (below
// the iOS safe-area inset) and translated by `pullDistance` so it appears to
// emerge from behind the header as the user pulls.
//
// Three-state arrow + label:
//   pulling    → ↓ "Pull to refresh"
//   release    → ↑ (rotated) "Release to refresh"
//   refreshing → spinner "Refreshing…"
//
// Carries no i18n: the three visible strings inject as `labels` (English
// defaults).

export type PullToRefreshLabels = {
  // Shown while dragging but short of the trigger distance.
  pull: string;
  // Shown once the drag has crossed the trigger distance.
  release: string;
  // Shown while `onRefresh` is in flight.
  refreshing: string;
};

const DEFAULT_LABELS: PullToRefreshLabels = {
  pull: "Pull to refresh",
  release: "Release to refresh",
  refreshing: "Refreshing…",
};

type Props = {
  state: PullToRefreshState;
  pullDistance: number;
  labels?: Partial<PullToRefreshLabels>;
};

export function PullToRefreshIndicator({ state, pullDistance, labels }: Props) {
  if (state === "idle" && pullDistance === 0) return null;

  const text = { ...DEFAULT_LABELS, ...labels };
  const label =
    state === "refreshing"
      ? text.refreshing
      : state === "release"
        ? text.release
        : text.pull;

  // The indicator slides from above the viewport into place. The -44px floor
  // matches the pill's approximate rendered height so it sits flush above the
  // page until pulled.
  const offset = Math.min(pullDistance, 70);
  const opacity = Math.min(1, pullDistance / 50);
  const rotated = state === "release" || state === "refreshing";
  // While refreshing, lock to the trigger position and ease the slide; during
  // the live drag, tracking must be 1:1 so the pull feels attached to the
  // finger.
  const smooth = state === "refreshing" || state === "idle";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[65] flex justify-center"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        transform: `translateY(${offset - 44}px)`,
        opacity,
        transition: smooth
          ? "transform 200ms ease-out, opacity 200ms ease-out"
          : "none",
      }}
    >
      <div className="inline-flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-fg shadow-md">
        {state === "refreshing" ? (
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowDownIcon
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              rotated ? "rotate-180" : ""
            }`}
          />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}
