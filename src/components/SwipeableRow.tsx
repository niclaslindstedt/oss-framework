// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode } from "react";

import { useDesktopPointer } from "../hooks/useMediaQuery.ts";
import {
  useRowSwipe,
  type RowSwipeOptions,
  type RowSwipeSide,
} from "../hooks/useRowSwipe.ts";
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
//     (delete-by-flick, file-away, …), with a labelled, coloured backdrop bared
//     as the row slides so the user reads the outcome before releasing.
//
// Every visible part is configurable: the button glyphs / labels and their
// background + text colours, and the commit backdrop's glyph, caption, and
// colours. A side renders only what the caller declares — the framework names
// no action and ships no default caption or glyph (the accent backdrop colour
// is the one default), so a row stays domain-agnostic.
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
      /** Caption on the backdrop bared as the row slides. Omitted ⇒ none. */
      label?: string;
      /** Glyph on the backdrop. Omitted ⇒ none. */
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

  // --- Sugar for the common left-reveal shape ---
  /**
   * Buttons revealed by a left swipe. Shorthand for a `trailing` reveal; ignored
   * when `trailing` is set. Leave empty to offer no left action.
   */
  actions?: RowAction[];
  /** Width (px) of each `actions` button. Default 56. */
  actionButtonWidth?: number;

  /** Forwarded swipe thresholds (axis lock, latch / commit distances, …). */
  options?: RowSwipeOptions;
  /**
   * Paint a drop-target highlight over the row — a tinted overlay and accent
   * ring drawn *on top* of the (opaque) sliding foreground. A row hovered by a
   * drag-and-drop gesture sets this so it reads as the landing spot; the
   * overlay sits above the row's own `bg-surface`, which would otherwise hide a
   * tint set on an ancestor drop-zone element.
   */
  highlighted?: boolean;
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
  actionButtonWidth = DEFAULT_BUTTON_WIDTH,
  options,
  highlighted = false,
  className = "",
  children,
}: SwipeableRowProps) {
  // Resolve the `actions` sugar onto the trailing reveal.
  const trailingSide: SwipeSide | undefined =
    trailing ??
    (actions && actions.length > 0
      ? { kind: "reveal", buttons: actions, buttonWidth: actionButtonWidth }
      : undefined);
  const leadingSide: SwipeSide | undefined = leading;

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

  // Swipe is a touch affordance — a desktop pointer reaches the same actions
  // through a right-click menu (`RowActionMenu`), so the gesture stays off there
  // rather than letting a mouse drag latch a row open. `options.enabled` lets a
  // caller force the gesture on (or off) regardless of pointer.
  const desktop = useDesktopPointer();
  const swipeEnabled = options?.enabled ?? !desktop;

  const swipe = useRowSwipe(undefined, {
    ...options,
    enabled: swipeEnabled,
    trailing: toHookSide(trailingSide, trailingWidth),
    leading: toHookSide(leadingSide, leadingWidth),
  });

  // The drop-target highlight — a tinted, accent-ringed overlay painted above
  // the (opaque) foreground so it shows through the row's own background.
  const overlay = highlighted ? (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 bg-accent/15 ring-2 ring-accent ring-inset"
    />
  ) : null;

  // Nothing to swipe — a bare row, or one whose swipe is gated off (desktop) —
  // renders its content plainly, carrying no gesture, no extra DOM, and no
  // phantom latch.
  if ((!trailingSide && !leadingSide) || !swipeEnabled) {
    return (
      <div className={`relative ${className}`.trim()}>
        {overlay}
        {children}
      </div>
    );
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
        {overlay}
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
        {side.icon}
        {side.label && <span>{side.label}</span>}
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
