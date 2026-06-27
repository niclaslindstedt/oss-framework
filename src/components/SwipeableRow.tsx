// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode } from "react";

import {
  useRowSwipe,
  type RowSwipeOptions,
  type RowSwipeSide,
} from "../hooks/useRowSwipe.ts";
import { ArchiveIcon } from "./icons.tsx";
import type { RowAction } from "./RowActionMenu.tsx";

// A list row with the two-handed swipe gesture both source apps grew, lifted off
// the adopter so a row only has to declare its actions — not re-build the strip
// markup, the reveal masking, and the slide-off timing each time.
//
// Each side is configurable independently. A swipe LEFT (`trailing`) and a
// swipe RIGHT (`leading`) can each be either:
//
//   • a "reveal" — latch a strip of icon buttons open behind the row (rename,
//     delete, …) for a deliberate tap, so a destructive action is never a
//     single flick; or
//   • a "commit" — drag the row off past the threshold to fire one action
//     (archive, delete-by-flick, …), with a labelled, coloured backdrop bared
//     as the row slides so the user reads the outcome before releasing.
//
// Every visible part is configurable: the button glyphs / labels and their
// background + text colours, and the commit backdrop's glyph, caption, and
// colours. Defaults match the classic shape — a left reveal of icon buttons, a
// right "Archive" commit on the accent — so the common case stays a one-liner.
//
// The component owns everything the gesture needs to look right: the strips
// uncovered on each swipe, an opaque sliding foreground (the `children`) so a
// strip never bleeds through until swiped its way, and the
// `[touch-action:pan-y]` + `data-drawer-swipe-ignore` tags that keep a vertical
// scroll — and an enclosing drawer's own swipe-to-close — from fighting the row.
//
// The reveal buttons use the same `RowAction` shape `RowActionMenu` takes, so a
// row can offer identical actions through a long-press menu on desktop and a
// swipe on touch from one declaration; `SwipeActionButton` widens it with the
// optional per-button colours.

const DEFAULT_BUTTON_WIDTH = 56;

/**
 * A button in a reveal strip — a {@link RowAction} (label / icon / onSelect /
 * danger) plus optional explicit colours. `danger` styles it red; `background`
 * / `color` (Tailwind classes) override either default.
 */
export type SwipeActionButton = RowAction & {
  /** Tailwind background class. Default `bg-surface-3`, or `bg-danger` when `danger`. */
  background?: string;
  /** Tailwind text-colour class. Default `text-fg`, or `text-white` when `danger`. */
  color?: string;
};

/**
 * One side of the swipe: either a latched strip of tappable buttons, or a
 * single commit action the row flicks off to.
 */
export type SwipeSide =
  | {
      kind: "reveal";
      /** Buttons rendered in the strip, in order from the row's edge inward. */
      buttons: SwipeActionButton[];
      /** Width (px) of each button — the per-button slice the latch opens. Default 56. */
      buttonWidth?: number;
    }
  | {
      kind: "commit";
      /** Fired once the row is dragged past the threshold and released. */
      onCommit: () => void;
      /** Caption on the backdrop bared as the row slides. Default "Archive". */
      label?: string;
      /** Glyph on the backdrop. Defaults to the framework archive box. */
      icon?: ReactNode;
      /** Tailwind background class for the backdrop. Default `bg-accent`. */
      background?: string;
      /** Tailwind text-colour class for the backdrop. Default `text-page-bg`. */
      color?: string;
    };

export type SwipeableRowProps = {
  /** The right-swipe side (revealed / committed as the row slides right). */
  leading?: SwipeSide;
  /** The left-swipe side (revealed / committed as the row slides left). */
  trailing?: SwipeSide;

  // --- Back-compat sugar for the classic left-reveal / right-archive shape ---
  /**
   * Buttons revealed by a left swipe. Shorthand for a `trailing` reveal; ignored
   * when `trailing` is set. Leave empty to offer no left action.
   */
  actions?: RowAction[];
  /**
   * Fired when the row is dragged right past the threshold — the archive
   * outcome. Shorthand for a `leading` commit; ignored when `leading` is set.
   */
  onArchive?: () => void;
  /** Caption for the archive backdrop. Default "Archive". */
  archiveLabel?: string;
  /** Glyph for the archive backdrop. Defaults to the framework archive box. */
  archiveIcon?: ReactNode;
  /** Width (px) of each `actions` button. Default 56. */
  actionButtonWidth?: number;

  /** Forwarded swipe thresholds (axis lock, latch / commit distances, …). */
  options?: RowSwipeOptions;
  className?: string;
  /** The row content — the opaque sliding foreground. */
  children: ReactNode;
};

// Map a public side descriptor to the hook's side option (or `undefined` to
// leave that side off).
function toHookSide(
  side: SwipeSide | undefined,
  width: number,
): RowSwipeSide | undefined {
  if (!side) return undefined;
  return side.kind === "reveal"
    ? { intent: "reveal", width }
    : { intent: "commit", onCommit: side.onCommit };
}

export function SwipeableRow({
  leading,
  trailing,
  actions,
  onArchive,
  archiveLabel = "Archive",
  archiveIcon,
  actionButtonWidth = DEFAULT_BUTTON_WIDTH,
  options,
  className = "",
  children,
}: SwipeableRowProps) {
  // Resolve the back-compat sugar onto the two sides.
  const trailingSide: SwipeSide | undefined =
    trailing ??
    (actions && actions.length > 0
      ? { kind: "reveal", buttons: actions, buttonWidth: actionButtonWidth }
      : undefined);
  const leadingSide: SwipeSide | undefined =
    leading ??
    (onArchive
      ? {
          kind: "commit",
          onCommit: onArchive,
          label: archiveLabel,
          icon: archiveIcon,
        }
      : undefined);

  // A reveal strip latches open exactly wide enough to seat every button.
  const trailingWidth =
    trailingSide?.kind === "reveal"
      ? trailingSide.buttons.length *
        (trailingSide.buttonWidth ?? DEFAULT_BUTTON_WIDTH)
      : 0;
  const leadingWidth =
    leadingSide?.kind === "reveal"
      ? leadingSide.buttons.length *
        (leadingSide.buttonWidth ?? DEFAULT_BUTTON_WIDTH)
      : 0;

  const swipe = useRowSwipe(undefined, {
    ...options,
    trailing: toHookSide(trailingSide, trailingWidth),
    leading: toHookSide(leadingSide, leadingWidth),
  });

  // Nothing to swipe — render the content plainly so a bare row carries no
  // gesture, no extra DOM, and no phantom latch.
  if (!trailingSide && !leadingSide) {
    return <div className={className || undefined}>{children}</div>;
  }

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
      {/* Leading backdrop / strip, uncovered as the foreground slides right.
          Hidden while the row sits closed or open-left so it never flashes the
          wrong way. */}
      {leadingSide && (
        <SideLayer
          side={leadingSide}
          edge="leading"
          visible={swipe.offset > 0}
        />
      )}

      {/* Trailing backdrop / strip, uncovered as the foreground slides left. */}
      {trailingSide && (
        <SideLayer
          side={trailingSide}
          edge="trailing"
          visible={swipe.offset < 0}
          onButtonSelect={swipe.close}
        />
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

// One revealed side — a strip of buttons (reveal) or a captioned backdrop
// (commit). `edge` pins it to the side the swipe bares it from.
function SideLayer({
  side,
  edge,
  visible,
  onButtonSelect,
}: {
  side: SwipeSide;
  edge: "leading" | "trailing";
  visible: boolean;
  // Closes the row after a reveal button fires (so the strip latches shut).
  onButtonSelect?: () => void;
}) {
  // Trailing reveals seat their buttons against the right edge; leading ones
  // (and every commit backdrop) read from the left edge inward.
  const justify = edge === "trailing" ? "justify-end" : "justify-start";
  const hidden = visible ? "" : "invisible";

  if (side.kind === "commit") {
    return (
      <div
        aria-hidden={!visible}
        className={`absolute inset-0 flex items-center gap-2 px-4 text-xs font-semibold tracking-wide uppercase ${justify} ${
          side.background ?? "bg-accent"
        } ${side.color ?? "text-page-bg"} ${hidden}`}
      >
        {side.icon ?? <ArchiveIcon className="h-5 w-5" />}
        <span>{side.label ?? "Archive"}</span>
      </div>
    );
  }

  const buttonWidth = side.buttonWidth ?? DEFAULT_BUTTON_WIDTH;
  return (
    <div
      aria-hidden={!visible}
      className={`absolute inset-0 flex items-stretch ${justify} ${hidden}`}
    >
      {side.buttons.map((action) => (
        <button
          key={action.label}
          type="button"
          aria-label={action.label}
          onClick={() => {
            onButtonSelect?.();
            action.onSelect();
          }}
          style={{ width: buttonWidth }}
          className={`flex shrink-0 items-center justify-center ${
            action.background ?? (action.danger ? "bg-danger" : "bg-surface-3")
          } ${
            action.color ??
            (action.danger ? "text-white" : "text-fg hover:text-fg-bright")
          }`}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
