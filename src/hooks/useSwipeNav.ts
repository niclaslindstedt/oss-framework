// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, type RefObject } from "react";

// A horizontal swipe that moves one place along an ordered axis — the gesture
// a row of tabs, a stack of screens, or a run of months is navigated by on a
// phone.
//
// Deliberately touch-only. A mouse has a scrollbar, arrow keys and a visible
// control for the same move; reading a horizontal drag from a pointer would
// mostly catch text selection. So this is the finger's affordance, and it is
// never the only way through: whatever the swipe steps must also be steppable
// by something a keyboard can reach.
//
// **What it refuses.** A page gesture that fires when the user meant something
// else is worse than not having the gesture at all — a control that jumps to
// the next screen instead of moving is a broken control. So it stands down at
// the start on:
//
//   - anything matching `ignoreSelector`, which defaults to the controls that
//     own the horizontal axis where they are: a range input (the whole of a
//     slider is a horizontal drag), anything inside a dialog, and anything
//     marked `data-swipe-ignore`;
//   - anything between the touch and the root that scrolls sideways — the
//     finger is scrolling it, not paging the app.
//
// The marker is a *claim* on the axis rather than a veto of it, which is what
// lets these nest: an inner region marks itself `data-swipe-ignore` to stop
// the outer mount, then mounts its own hook on that same element. The outer
// hook finds the marker on a descendant and stands down; the inner one finds
// it on its own root and proceeds. That is how a month grid inside a swipeable
// screen pages months while the screen still pages tabs.
//
// And it bails mid-gesture on a second finger (a pinch is not a swipe) and on
// a drag that resolves mostly vertical (the page scrolls far more often than
// it pages, so the diagonal has to go scrolling's way).

/** How far the finger must travel before it counts, in CSS pixels. About a
 *  centimetre: far enough that it cannot be a tap that slid, short enough for
 *  a thumb pivoting from the bottom corner of a 375px screen. */
const MIN_DISTANCE = 60;

/** How much of the travel has to be horizontal. A swipe at 45° is ambiguous
 *  and the page is what a finger is usually doing, so the horizontal leg has
 *  to be the clearly longer one. */
const MAX_OFF_AXIS_RATIO = 0.6;

/** Controls that own the horizontal axis where they are. */
const IGNORED = 'input[type="range"], [role="dialog"], [data-swipe-ignore]';

/** Whether anything between `target` and `root` scrolls sideways — in which
 *  case the finger is scrolling it, not paging the app. */
function scrollsHorizontally(target: Element, root: Element): boolean {
  let node: Element | null = target;
  while (node && node !== root.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

export type SwipeNavOptions = {
  /** Travel required before a drag counts as a swipe, in CSS pixels.
   *  Default 60. */
  minDistance?: number;
  /** The most vertical a swipe may be, as a fraction of its horizontal leg:
   *  `|dy| > |dx| * ratio` stands down. Default 0.6. */
  maxOffAxisRatio?: number;
  /** Elements the gesture refuses to start on, as a CSS selector. Defaults to
   *  range inputs, dialogs and `[data-swipe-ignore]`. A match *on the root
   *  itself* is read as this mount's own claim and does not stand down — see
   *  the nesting note above. */
  ignoreSelector?: string;
  /** Set false to unbind without unmounting — a screen that is off-stage, or
   *  a mode where the axis means something else. Default true. */
  enabled?: boolean;
};

/**
 * Fire `onSwipe(1)` on a swipe from right to left and `onSwipe(-1)` on one
 * from left to right — the direction the *content* moves, so a leftward swipe
 * brings the next item in from the right, as a row of pages does everywhere
 * else.
 *
 * `onSwipe` is read on every gesture through the effect's own dependency, so
 * pass a stable callback (`useCallback`) if re-binding the listeners on each
 * render would be wasteful.
 */
export function useSwipeNav(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (direction: 1 | -1) => void,
  options: SwipeNavOptions = {},
): void {
  const {
    minDistance = MIN_DISTANCE,
    maxOffAxisRatio = MAX_OFF_AXIS_RATIO,
    ignoreSelector = IGNORED,
    enabled = true,
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // The gesture in progress, or null when there is nothing to finish —
    // which is also how a bail is expressed: forget the start, and the end
    // has nothing to act on.
    let from: { x: number; y: number } | null = null;

    const start = (e: TouchEvent) => {
      from = null;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const target = touch.target;
      if (!(target instanceof Element)) return;
      // A marker on the hook's own root is this gesture's claim on the axis,
      // not a veto of it — only one on something *inside* the root bails.
      const ignored = target.closest(ignoreSelector);
      if (ignored && ignored !== element) return;
      if (scrollsHorizontally(target, element)) return;
      from = { x: touch.clientX, y: touch.clientY };
    };

    // A second finger means a pinch or a two-finger scroll, neither of which
    // should end as a step along the axis.
    const move = (e: TouchEvent) => {
      if (e.touches.length > 1) from = null;
    };

    const end = (e: TouchEvent) => {
      const origin = from;
      from = null;
      if (!origin) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < minDistance) return;
      if (Math.abs(dy) > Math.abs(dx) * maxOffAxisRatio) return;
      onSwipe(dx < 0 ? 1 : -1);
    };

    // Passive throughout: nothing here calls `preventDefault`, and saying so
    // keeps the scroller off the main thread's critical path.
    const listener = { passive: true } as const;
    element.addEventListener("touchstart", start, listener);
    element.addEventListener("touchmove", move, listener);
    element.addEventListener("touchend", end, listener);
    element.addEventListener("touchcancel", end, listener);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, [ref, onSwipe, minDistance, maxOffAxisRatio, ignoreSelector, enabled]);
}
