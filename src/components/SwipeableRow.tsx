// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode } from "react";

import { useRowSwipe, type RowSwipeOptions } from "../hooks/useRowSwipe.ts";
import { ArchiveIcon } from "./icons.tsx";
import type { RowAction } from "./RowActionMenu.tsx";

// A list row with the two-handed swipe gesture both source apps grew, lifted off
// the adopter so a row only has to declare its actions — not re-build the strip
// markup, the reveal masking, and the slide-off timing each time:
//
//   • swipe LEFT  → latch a strip of icon actions open behind the row (rename,
//                   delete, …) — a deliberate rest the user taps, so a
//                   destructive action is never a single flick.
//   • swipe RIGHT → drag the row off to archive it, once dragged past the
//                   threshold ("swiped long enough"); a short drag snaps back.
//                   Omit `onArchive` to offer the left-reveal alone.
//
// The component owns everything the gesture needs to look right: the action
// strip uncovered on the left swipe, the archive backdrop uncovered on the
// right, an opaque sliding foreground (the `children`) so neither strip bleeds
// through until it's swiped its way, and the `[touch-action:pan-y]` +
// `data-drawer-swipe-ignore` tags that keep a vertical scroll — and an
// enclosing drawer's own swipe-to-close — from fighting the row. The caller
// passes the row content and the actions; the framework owns the choreography.
//
// `RowAction` is the same shape `RowActionMenu` takes (label / icon / onSelect /
// danger), so a row can offer identical actions through a long-press menu on
// desktop and a swipe on touch from one declaration.

export type SwipeableRowProps = {
  /**
   * Actions revealed by a left swipe, rendered as icon buttons in the strip
   * (right edge). Each uses its `label` as the button's accessible name and
   * tints red when `danger`. Leave empty to offer the archive swipe alone.
   */
  actions?: RowAction[];
  /**
   * Fired when the row is dragged right past the threshold — the archive
   * outcome. Omit to disable the right swipe entirely (it snaps back).
   */
  onArchive?: () => void;
  /** Accessible label / caption for the archive backdrop. Default "Archive". */
  archiveLabel?: string;
  /** Icon shown on the archive backdrop. Defaults to the framework archive box. */
  archiveIcon?: ReactNode;
  /**
   * Width (px) of each action button, and so the per-button slice of the strip
   * the left swipe latches open. Default 56.
   */
  actionButtonWidth?: number;
  /** Forwarded swipe thresholds (axis lock, dismiss distance, …). */
  options?: RowSwipeOptions;
  className?: string;
  /** The row content — the opaque sliding foreground. */
  children: ReactNode;
};

const DEFAULT_BUTTON_WIDTH = 56;

export function SwipeableRow({
  actions = [],
  onArchive,
  archiveLabel = "Archive",
  archiveIcon,
  actionButtonWidth = DEFAULT_BUTTON_WIDTH,
  options,
  className = "",
  children,
}: SwipeableRowProps) {
  // The strip latches open exactly wide enough to seat every action button.
  const stripWidth = actions.length * actionButtonWidth;
  const swipe = useRowSwipe(onArchive, {
    actionWidth: stripWidth || undefined,
    ...options,
  });

  return (
    <div
      // Tag the row so an enclosing `Sidebar`'s swipe-to-close stands down while
      // a finger is on it — the row owns the horizontal axis here.
      data-drawer-swipe-ignore
      // Kill text selection and the iOS touch-callout: a swipe is a held,
      // dragging touch, and without this the platform selects the row's label
      // (or pops its callout) mid-gesture on mobile.
      className={`relative overflow-hidden select-none [-webkit-touch-callout:none] ${className}`.trim()}
    >
      {/* Archive backdrop, uncovered as the foreground slides right. Hidden
          while the row sits closed or open-left so it never flashes the wrong
          way. */}
      {onArchive && (
        <div
          aria-hidden={swipe.offset <= 0}
          className={`absolute inset-0 flex items-center justify-start gap-2 bg-accent px-4 text-xs font-semibold tracking-wide text-page-bg uppercase ${
            swipe.offset > 0 ? "" : "invisible"
          }`}
        >
          {archiveIcon ?? <ArchiveIcon className="h-5 w-5" />}
          <span>{archiveLabel}</span>
        </div>
      )}

      {/* Action strip, uncovered as the foreground slides left. */}
      {actions.length > 0 && (
        <div
          aria-hidden={swipe.offset >= 0}
          className={`absolute inset-0 flex items-stretch justify-end ${
            swipe.offset < 0 ? "" : "invisible"
          }`}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              aria-label={action.label}
              onClick={() => {
                swipe.close();
                action.onSelect();
              }}
              style={{ width: actionButtonWidth }}
              className={`flex shrink-0 items-center justify-center ${
                action.danger
                  ? "bg-danger text-white"
                  : "bg-surface-3 text-fg hover:text-fg-bright"
              }`}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {/* Sliding foreground — the row itself. Opaque so the strips stay hidden
          until swiped into view; `pan-y` lets a vertical drag scroll the list
          while the hook claims a horizontal one. */}
      <div
        {...swipe.handlers}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        className={`relative bg-surface [touch-action:pan-y] ${
          swipe.animating ? "transition-transform duration-200" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
