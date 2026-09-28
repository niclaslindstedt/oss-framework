// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, type PointerEvent } from "react";

import { LONG_PRESS_MS } from "./tap.ts";

// Detect a long press — a pointer held in place past a delay — and hand back
// the pointer handlers a caller spreads onto the element it wants to watch.
// The touch counterpart to a desktop right-click: where a mouse opens a row's
// action menu with the secondary button, a finger opens it by pressing and
// holding. A drag past `moveTolerance` (a scroll, a swipe) cancels the press,
// so the gesture never fights the surfaces it sits inside.
//
// When the press fires it also swallows the trailing `click` the same pointer
// sequence emits, so the element underneath (a folder's expand toggle, a list
// row) doesn't *also* activate — the long press replaces the tap rather than
// stacking on top of it. The swallow belongs to the gesture, not to a clock:
// it stands however long the finger stays down after the press fired, and it
// ends with that gesture (see `swallowClickOfThisGesture`).

export type LongPressHandlers = {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
};

export type LongPressOptions = {
  // How long (ms) the pointer must stay down before the press fires. 500ms
  // matches the platform long-press / context-menu convention.
  delayMs?: number;
  // How far (px) the pointer may drift before the press is treated as a drag
  // and cancelled. Generous enough to ignore the jitter of a held finger.
  moveTolerance?: number;
  // Gates the whole gesture off (e.g. there are no actions to show).
  enabled?: boolean;
};

export function useLongPress(
  onLongPress: () => void,
  {
    delayMs = LONG_PRESS_MS,
    moveTolerance = 10,
    enabled = true,
  }: LongPressOptions = {},
): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Hold the latest callback in a ref so the handlers stay referentially
  // stable even as the caller passes a fresh closure each render.
  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  // Clear any pending timer if the component unmounts mid-press.
  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      // Only a primary press arms the hold; a secondary (right) click takes
      // the platform context-menu path the caller wires separately.
      if (!enabled || e.button !== 0) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        origin.current = null;
        swallowClickOfThisGesture(e.pointerId);
        cbRef.current();
      }, delayMs);
    },
    [enabled, delayMs],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const start = origin.current;
      if (timer.current === null || !start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > moveTolerance * moveTolerance) clear();
    },
    [moveTolerance, clear],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}

/** How long after the finger lifts a click that never came is still waited
 *  for. Measured from the release, not from the press: the platform emits the
 *  click in the same turn as `pointerup` (WebKit a frame or two later), so this
 *  only bounds how long a gesture that emitted no click at all — a
 *  `pointercancel`, a long press the OS turned into its own callout — leaves
 *  the listener behind. */
const RELEASE_GRACE_MS = 400;

/**
 * Swallow the click that ends the gesture whose long press just fired, and
 * nothing after it.
 *
 * The click that trails a press arrives on pointer-up, which is as late as the
 * finger decides — a hold of five seconds emits it five seconds on. So the
 * window is not a fixed time from the press but the rest of the gesture: the
 * capture-phase listener stands until it has stopped one click, and otherwise
 * goes when the gesture is plainly over — the next `pointerdown` (a new
 * gesture, whose own click must get through), or a short grace after this
 * pointer lifts without a click following. Window-level listeners rather than
 * the element's own, because the press often unmounts the element it fired on
 * (a menu opens over it) and the click still lands on whatever is underneath.
 */
function swallowClickOfThisGesture(pointerId: number | undefined): void {
  let grace: number | null = null;
  const done = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", done, true);
    window.removeEventListener("pointerup", released, true);
    window.removeEventListener("pointercancel", released, true);
    if (grace !== null) window.clearTimeout(grace);
    grace = null;
  };
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const released = (e: Event) => {
    const id = (e as { pointerId?: number }).pointerId;
    // Another finger lifting is not this gesture ending.
    if (pointerId !== undefined && id !== undefined && id !== pointerId) {
      return;
    }
    if (grace !== null) window.clearTimeout(grace);
    grace = window.setTimeout(done, RELEASE_GRACE_MS);
  };
  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", done, true);
  window.addEventListener("pointerup", released, true);
  window.addEventListener("pointercancel", released, true);
}
