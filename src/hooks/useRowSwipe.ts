// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type PointerEvent } from "react";

// Swipe-to-reveal gesture for a list row. It arms on a dominant horizontal
// drag past a small threshold and drives a live transform with two outcomes:
//
//   • swipe LEFT  → latch the foreground open to uncover a trailing action
//                   (e.g. a Delete button) — a deliberate two-step so the
//                   destructive action is never a single flick.
//   • swipe RIGHT → fire `onDismiss` once past the threshold; the foreground
//                   slides off and the caller drops the row on the next render.
//                   Passing no `onDismiss` opts the right-swipe out entirely —
//                   the drag rubber-bands and snaps back, so a row can offer the
//                   left-reveal alone.
//
// The caller spreads `handlers` onto the sliding foreground element and
// applies `translateX(offset)`, with `animating` gating the CSS transition so
// only the settle / slide-off animates, not the live drag. The element behind
// the foreground holds the revealed action strip.
//
// Extracted from the `notes` and `checklist` apps, where this hook was
// byte-identical bar comments — a clean shared-verbatim migration. The
// app-specific pixel thresholds (action-strip width, latch / dismiss
// distances) are exposed as `options` so an adopter can match its own strip.

export interface RowSwipeOptions {
  // Width of the action strip the row renders behind the foreground; the
  // left-latch rests the foreground exactly this far open. Default 96.
  actionWidth?: number;
  // Left-swipe distance that latches the action drawer open. Default 48.
  openAt?: number;
  // Right-swipe distance that triggers `onDismiss`. Default 96.
  dismissAt?: number;
  // Movement before the gesture commits to a horizontal vs. vertical axis.
  // Default 8.
  axisLock?: number;
  // How long the slide-off animation runs before `onDismiss` fires, in ms.
  // Keep it in step with the caller's CSS transition. Default 180.
  dismissMs?: number;
}

const DEFAULTS = {
  actionWidth: 96,
  openAt: 48,
  dismissAt: 96,
  axisLock: 8,
  dismissMs: 180,
} as const;

export interface RowSwipe {
  offset: number;
  animating: boolean;
  open: boolean;
  close: () => void;
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClickCapture: (e: React.MouseEvent) => void;
  };
}

export function useRowSwipe(
  onDismiss?: () => void,
  options: RowSwipeOptions = {},
): RowSwipe {
  const ACTION_W = options.actionWidth ?? DEFAULTS.actionWidth;
  const OPEN_AT = options.openAt ?? DEFAULTS.openAt;
  const DISMISS_AT = options.dismissAt ?? DEFAULTS.dismissAt;
  const AXIS_LOCK = options.axisLock ?? DEFAULTS.axisLock;
  const DISMISS_MS = options.dismissMs ?? DEFAULTS.dismissMs;

  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [open, setOpen] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "h" | "v">("none");
  const dx = useRef(0);
  const dragged = useRef(false);
  const wasOpen = useRef(false);
  const pointerId = useRef<number | null>(null);

  const close = useCallback(() => {
    setAnimating(true);
    setOffset(0);
    setOpen(false);
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      axis.current = "none";
      dx.current = 0;
      dragged.current = false;
      wasOpen.current = open;
      setAnimating(false);
    },
    [open],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (pointerId.current !== e.pointerId) return;
      const mx = e.clientX - startX.current;
      const my = e.clientY - startY.current;
      if (axis.current === "none") {
        if (Math.abs(mx) < AXIS_LOCK && Math.abs(my) < AXIS_LOCK) return;
        axis.current = Math.abs(mx) > Math.abs(my) ? "h" : "v";
        if (axis.current === "h")
          e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (axis.current !== "h") return;
      e.preventDefault();
      dragged.current = true;
      let next = (wasOpen.current ? -ACTION_W : 0) + mx;
      // Rubber-band past the natural left extent so it feels bounded.
      if (next < -ACTION_W) next = -ACTION_W + (next + ACTION_W) * 0.3;
      dx.current = next;
      setOffset(next);
    },
    [ACTION_W, AXIS_LOCK],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (pointerId.current !== e.pointerId) return;
      pointerId.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      if (axis.current !== "h") {
        axis.current = "none";
        return;
      }
      axis.current = "none";
      const traveled = dx.current;
      setAnimating(true);
      // A right-swipe past the threshold dismisses — but only when the caller
      // wired `onDismiss`. Without it the gesture has no right-hand outcome, so
      // the drag simply settles back closed (handled by the fall-through).
      if (traveled >= DISMISS_AT && onDismiss) {
        setOpen(false);
        setOffset(e.currentTarget.offsetWidth);
        window.setTimeout(onDismiss, DISMISS_MS);
        return;
      }
      if (traveled <= -OPEN_AT) {
        setOpen(true);
        setOffset(-ACTION_W);
        return;
      }
      setOpen(false);
      setOffset(0);
    },
    [ACTION_W, OPEN_AT, DISMISS_AT, DISMISS_MS, onDismiss],
  );

  // Swallow the click that trails a drag (so a swipe never activates the row's
  // own controls), and turn a tap on an already-open row into a close.
  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (dragged.current) {
        e.preventDefault();
        e.stopPropagation();
        dragged.current = false;
        return;
      }
      if (wasOpen.current && open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    [open, close],
  );

  return {
    offset,
    animating,
    open,
    close,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}
