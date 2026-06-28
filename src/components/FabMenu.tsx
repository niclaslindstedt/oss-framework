// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { DismissBackdrop } from "./DismissBackdrop.tsx";

// A floating action button that fans out into a row of bulk actions on a long
// press — the gesture both source apps grew on their "add" FAB so the primary
// create action stays a one-tap target while power actions (archive every
// finished item, delete them) hide behind a hold. A plain tap fires
// `onActivate`; pressing and holding scales the (+) away and scales the action
// row in over the same spot, so it reads as the button morphing into its
// alternatives. An action, an outside tap, or Escape collapses back to the (+).
//
// The fiddly parts it owns so an adopter doesn't re-derive them: it releases
// the (+)'s implicit pointer capture the instant the menu fans out (or the
// freshly-shown buttons never see the pointerup that ends the hold on iOS), and
// it ignores that very pointerup so the opening hold doesn't immediately fire an
// action under the finger — the actions fire on the next, deliberate tap. The
// action row is portalled to `document.body` and centred on the (+)'s measured
// box, so it overlays the button even when a pinned sidebar offsets the content
// column from the layout viewport.

export type FabMenuAction = {
  /** Glyph rendered in the action button. */
  icon: ReactNode;
  /** Accessible label for the action button. */
  label: string;
  /** Fired on a deliberate tap of the revealed button. */
  onSelect: () => void;
  /** Greys the button out and ignores taps (e.g. nothing to act on). */
  disabled?: boolean;
  /** Tailwind colour classes for the button (background + text). */
  className?: string;
};

// How long the (+) must be held before the action row fans out.
const DEFAULT_LONG_PRESS_MS = 450;

export function FabMenu({
  onActivate,
  actions,
  children,
  longPressMs = DEFAULT_LONG_PRESS_MS,
  className = "",
  moreActionsLabel = "More actions",
  ...rest
}: {
  /** A plain tap fires this — the primary create action. */
  onActivate: () => void;
  /** The bulk actions revealed by a long press, left to right. */
  actions: FabMenuAction[];
  /** The FAB's glyph (e.g. a plus icon). */
  children: ReactNode;
  /** Hold duration (ms) before the menu fans out. Default 450. */
  longPressMs?: number;
  /** Extra classes for the round FAB. */
  className?: string;
  /** Accessible label for the revealed action group. */
  moreActionsLabel?: string;
  /** Accessible label for the FAB itself (required — it is icon-only). */
  "aria-label": string;
}) {
  const ariaLabel = rest["aria-label"];
  const [expanded, setExpanded] = useState(false);
  // The viewport-space centre of the (+) when it fanned out, so the portalled
  // row overlays it rather than the (sidebar-shifted) layout viewport.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  // Set the moment the hold crosses the threshold so the trailing click that
  // ends the press doesn't also fire `onActivate`.
  const longPressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const pointerId = useRef<number | null>(null);
  // The pointer that opened the menu — its own lift must NOT fire an action.
  const openingPointerId = useRef<number | null>(null);
  // A button handled the gesture on pointerup; swallow the trailing click.
  const pointerHandled = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
    openingPointerId.current = null;
  }, []);

  useEscapeKey(expanded, collapse);

  const expandMenu = useCallback(() => {
    longPressed.current = true;
    const el = plusRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setAnchor({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    setExpanded(true);
    const id = pointerId.current;
    openingPointerId.current = id;
    if (el && id !== null && el.hasPointerCapture?.(id)) {
      el.releasePointerCapture(id);
    }
  }, []);

  const startPress = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (expanded) return;
      pointerId.current = e.pointerId;
      openingPointerId.current = null;
      longPressed.current = false;
      pointerHandled.current = false;
      timer.current = setTimeout(expandMenu, longPressMs);
    },
    [expanded, expandMenu, longPressMs],
  );

  const handleClick = useCallback(() => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onActivate();
  }, [clearTimer, onActivate]);

  const run = useCallback(
    (action: FabMenuAction) => {
      action.onSelect();
      collapse();
    },
    [collapse],
  );

  // Activate on pointerup (the reliable signal on iOS for a button that only
  // appears mid-gesture); the very pointerup ending the opening hold is ignored.
  const onActionPointerUp = useCallback(
    (action: FabMenuAction) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerId === openingPointerId.current) {
        openingPointerId.current = null;
        pointerHandled.current = true;
        return;
      }
      pointerHandled.current = true;
      run(action);
    },
    [run],
  );
  const onActionClick = useCallback(
    (action: FabMenuAction) => () => {
      if (pointerHandled.current) {
        pointerHandled.current = false;
        return;
      }
      run(action);
    },
    [run],
  );

  return (
    <>
      {expanded && <DismissBackdrop onDismiss={collapse} />}

      <button
        ref={plusRef}
        type="button"
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={expanded}
        className={`flex h-14 w-14 touch-none cursor-pointer items-center justify-center rounded-full bg-accent text-page-bg shadow-lg transition-all duration-200 select-none active:scale-95 ${
          expanded
            ? "pointer-events-none scale-0 opacity-0"
            : "scale-100 opacity-100"
        } ${className}`.trim()}
      >
        {children}
      </button>

      {createPortal(
        <div
          role="group"
          aria-label={moreActionsLabel}
          aria-hidden={!expanded}
          style={
            anchor ? { left: `${anchor.x}px`, top: `${anchor.y}px` } : undefined
          }
          className={`fixed z-[60] flex -translate-x-1/2 touch-none items-center gap-px overflow-hidden rounded-full bg-page-bg/40 shadow-lg transition-all duration-200 select-none ${
            anchor
              ? "-translate-y-1/2"
              : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2"
          } ${
            expanded
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0"
          }`}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={!expanded || action.disabled}
              onPointerUp={onActionPointerUp(action)}
              onClick={onActionClick(action)}
              aria-label={action.label}
              className={`flex items-center justify-center px-8 py-4 transition-[filter] active:brightness-90 disabled:opacity-40 ${
                action.className ?? "bg-accent text-page-bg"
              }`}
            >
              {action.icon}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
