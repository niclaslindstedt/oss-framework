// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type RefObject } from "react";

// Touch-driven "swipe down to close" for a modal sheet. Attaches native touch
// listeners to a card element (passed as a ref) and lets a downward drag pull
// the card with the finger; releasing past `closeDistance` fires `onClose`,
// anything short snaps back.
//
// Deliberately touch-only — drag-down-to-dismiss is a mobile sheet affordance.
// A desktop pointer reaches the same close through the backdrop, the × button,
// or Escape, so wiring pointer events here would only bake in a surprising
// "click-drag closes the dialog" behaviour.
//
// Scroll gate (the "or when scroll is not possible" half of the gesture): the
// drag only arms when the touch starts somewhere an upward reveal isn't already
// owed to a scroll region — i.e. on the header, or in scrollable content that
// is already at its top. Walking up from the touch target, if any scrollable
// ancestor inside the card is scrolled down, the gesture stands down and hands
// the touch back to normal scrolling; a header (no scrollable ancestor) always
// arms. So the card pulls down only once there's nothing left to scroll up to —
// exactly the bottom-sheet feel where the first downward drag scrolls and the
// next one dismisses.

// Default downward travel (px) the release must reach to fire `onClose`. Tuned
// to read as a deliberate dismiss, not a stray flick, while staying within one
// thumb pull. Overridable via `closeDistance`.
const DEFAULT_CLOSE_DISTANCE = 100;
// Movement (px) before the gesture commits to a vertical vs. horizontal axis.
// A drag that locks horizontal stands down so a sideways flick never pulls the
// sheet. Mirrors `useRowSwipe`'s axis lock.
const AXIS_LOCK = 8;

type Options = {
  // Gate the gesture off entirely (default true). When false the listeners are
  // not attached and the card never moves. Callers commonly pass the modal's
  // `open` flag and/or restrict it to the mobile-sheet layout.
  enabled?: boolean;
  // Downward distance (px) a release must reach to fire `onClose`. Defaults to
  // `DEFAULT_CLOSE_DISTANCE`.
  closeDistance?: number;
};

type Result = {
  // Current downward drag offset in px (0 at rest, never negative). The caller
  // applies `translateY(offset)` to the card.
  offset: number;
  // True while a downward drag is live. The caller gates the card's CSS
  // transition on its negation so the live drag tracks the finger 1:1 and only
  // the snap-back / settle animates.
  dragging: boolean;
};

// True only if every scrollable ancestor of `target` up to (and including)
// `boundary` is scrolled to its top. A header (no scrollable ancestor) and a
// not-yet-scrolled content region both pass; a mid-scrolled region fails so the
// touch stays a scroll.
function canStartFromTop(
  target: EventTarget | null,
  boundary: HTMLElement,
): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight;
    if (scrollable && el.scrollTop > 0) return false;
    if (el === boundary) break;
    el = el.parentElement;
  }
  return true;
}

export function useSwipeDownToClose(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: Options = {},
): Result {
  const { enabled = true, closeDistance = DEFAULT_CLOSE_DISTANCE } = options;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Mirror the live offset so the listeners read it on release without
  // re-subscribing every tick, and hold the latest `onClose` / `closeDistance`
  // in refs so changing either never re-runs the attach effect (callers pass a
  // fresh inline `onClose` every render).
  const offsetRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeDistanceRef = useRef(closeDistance);
  closeDistanceRef.current = closeDistance;

  useEffect(() => {
    const card = ref.current;
    if (!enabled || !card) return;

    let startX = 0;
    let startY = 0;
    let axis: "none" | "v" | "h" = "none";
    let armed = false;

    const setOffsetBoth = (next: number) => {
      offsetRef.current = next;
      setOffset(next);
    };

    const reset = () => {
      armed = false;
      axis = "none";
      setDragging(false);
      setOffsetBoth(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (!canStartFromTop(e.target, card)) return;
      armed = true;
      axis = "none";
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armed) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (axis === "none") {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        // A horizontal lock hands the touch back — the sheet only answers to a
        // vertical pull.
        axis = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
        if (axis === "h") {
          armed = false;
          return;
        }
      }
      if (axis !== "v") return;
      // Clamp to a downward pull: an upward drag rests the card at 0 rather than
      // lifting it off the top of the viewport.
      const next = Math.max(0, dy);
      setDragging(next > 0);
      setOffsetBoth(next);
      // Own the gesture: suppress the browser's overscroll / scroll-chaining
      // while the card is following the finger.
      if (next > 0 && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!armed || axis !== "v") {
        reset();
        return;
      }
      const traveled = offsetRef.current;
      armed = false;
      axis = "none";
      if (traveled >= closeDistanceRef.current) {
        // Leave the offset where the finger left it; the modal unmounts on
        // close, so there's no settle to animate.
        setDragging(false);
        onCloseRef.current();
        return;
      }
      // Short of the threshold — snap back. `dragging` flips false first so the
      // caller's transition re-engages and animates the return to 0.
      setDragging(false);
      setOffsetBoth(0);
    };

    card.addEventListener("touchstart", onTouchStart, { passive: true });
    // `touchmove` must NOT be passive — we `preventDefault()` once the pull is
    // live to suppress native overscroll.
    card.addEventListener("touchmove", onTouchMove, { passive: false });
    card.addEventListener("touchend", onTouchEnd);
    card.addEventListener("touchcancel", reset);

    return () => {
      card.removeEventListener("touchstart", onTouchStart);
      card.removeEventListener("touchmove", onTouchMove);
      card.removeEventListener("touchend", onTouchEnd);
      card.removeEventListener("touchcancel", reset);
      // Clear any in-progress drag state so a re-mount starts at rest.
      offsetRef.current = 0;
      setOffset(0);
      setDragging(false);
    };
  }, [ref, enabled]);

  return { offset, dragging };
}
