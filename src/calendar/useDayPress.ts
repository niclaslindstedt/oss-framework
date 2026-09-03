// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, type RefObject } from "react";

import type { DayKey } from "./grid.ts";

// Press and hold a day in a `MonthGrid` — the gesture an app arms a span
// selection, a context action, or a secondary editor with.
//
// It is added from *outside* the grid, by listening on the element the grid
// is mounted in, rather than by the grid growing an `onDayHold` prop. That is
// deliberate: a hold is one of several things an app might want out of a long
// press, and a calendar grid has no business knowing which. What the grid
// does owe the gesture is a way to answer "which day was that?" without a
// handler on the cell — which is the `data-day` marker it writes on every
// gridcell. So the hook reads the day straight off the markup, and an app
// gets the gesture without having to plant a marker of its own inside
// `renderDay`.
//
// **Pointer events rather than touch.** Unlike `useSwipeNav`, which is
// deliberately fingers-only, a hold is worth having on a mouse too — it is
// the same gesture, and a desktop user pressing a day for half a second means
// the same thing by it. Keyboards cannot hold anything, which is why the hold
// must never be the only way in: whatever it arms needs a button as well.
//
// **What must not happen.** A hold that fires and then also activates the day
// it fired on would undo itself, so the click that follows the release is
// swallowed. And the browser's own long-press behaviours — the text-selection
// callout, the context menu — are cancelled inside the grid: neither offers
// anything on a day cell, and both land squarely on top of whatever the user
// just started.

/** How long a press has to last. Long enough not to fire on a tap that
 *  lingered, short enough that a thumb held on a day gets an answer before it
 *  starts wondering. Around the platform conventions (Android and iOS both
 *  ~500ms for a callout), deliberately a hair under so the app's own gesture
 *  is the one that resolves first. */
const HOLD_MS = 450;

/** How far the pointer may drift before the press stops being a press. About
 *  a finger's own wobble; anything more is the start of a scroll or a swipe,
 *  and those belong to the page and the month respectively. */
const MAX_DRIFT = 10;

/** How long the confirming haptic tick runs, in milliseconds. A half-second
 *  press with no answer feels like a press that failed. */
const HAPTIC_MS = 12;

/** The day a press landed on, read off the `data-day` marker `MonthGrid`
 *  writes on every gridcell. */
function dayAt(target: EventTarget | null): DayKey | null {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-day]")?.getAttribute("data-day") ?? null;
}

export type DayPressOptions = {
  /** How long the press must last, in milliseconds. Default 450. */
  holdMs?: number;
  /** How far the pointer may drift before the press is abandoned, in CSS
   *  pixels. Default 10. */
  maxDrift?: number;
  /** Buzz on a phone that can when the hold fires. Default true; set false
   *  where the hold is not itself the confirmation. */
  haptics?: boolean;
  /** Set false to unbind without unmounting. Default true. */
  enabled?: boolean;
};

/**
 * Call `onHold(day)` when a day cell inside `ref` is pressed and held.
 *
 * `ref` goes on any element containing the grid — the wrapper the header and
 * the grid share is the usual place. The callback is read through a ref, so a
 * screen may pass a fresh closure every render without the listeners being
 * torn down and rebuilt around the gesture currently in flight.
 */
export function useDayPress(
  ref: RefObject<HTMLElement | null>,
  onHold: (day: DayKey) => void,
  options: DayPressOptions = {},
): void {
  const {
    holdMs = HOLD_MS,
    maxDrift = MAX_DRIFT,
    haptics = true,
    enabled = true,
  } = options;

  const held = useRef(onHold);
  held.current = onHold;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let origin: { x: number; y: number } | null = null;
    // True from the moment a hold fires until the next press. It is what the
    // click listener below reads: the release of a hold still produces a
    // click, and letting it through would activate the day the hold just
    // acted on.
    let fired = false;

    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      origin = null;
    };

    const down = (e: PointerEvent) => {
      cancel();
      fired = false;
      // The primary button only: a right-click is already a context menu, and
      // a middle-click is not a gesture worth having an opinion about.
      if (e.button !== 0) return;
      const day = dayAt(e.target);
      if (day === null) return;
      origin = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        timer = null;
        origin = null;
        fired = true;
        if (haptics) navigator.vibrate?.(HAPTIC_MS);
        held.current(day);
      }, holdMs);
    };

    const move = (e: PointerEvent) => {
      if (!origin) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (Math.hypot(dx, dy) > maxDrift) cancel();
    };

    // A capture listener, so it runs before the cell's own handler and can
    // stop the click reaching it. `fired` is left standing until the next
    // press: a hold that ends without a click (a pointercancel, a finger
    // lifted off the grid) has nothing to swallow and nothing to clean up.
    const click = (e: MouseEvent) => {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Nothing on a day cell has a context menu worth opening, and on a phone
    // this is the menu that would land on top of what the hold just started.
    const contextmenu = (e: MouseEvent) => {
      if (dayAt(e.target) !== null) e.preventDefault();
    };

    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", cancel);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("pointerleave", cancel);
    element.addEventListener("click", click, true);
    element.addEventListener("contextmenu", contextmenu);
    return () => {
      cancel();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", cancel);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("pointerleave", cancel);
      element.removeEventListener("click", click, true);
      element.removeEventListener("contextmenu", contextmenu);
    };
  }, [ref, holdMs, maxDrift, haptics, enabled]);
}
