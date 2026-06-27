// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, type PointerEvent } from "react";

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
// stacking on top of it.

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
  { delayMs = 500, moveTolerance = 10, enabled = true }: LongPressOptions = {},
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

  // After the press fires, the same touch still emits a `click` on pointer-up.
  // Catch it once in the capture phase and stop it, so the long press doesn't
  // also trigger the element's normal tap action. Self-removes after the click
  // (or shortly after, if the platform emits none).
  const suppressNextClick = useCallback(() => {
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.removeEventListener("click", swallow, true);
    };
    window.addEventListener("click", swallow, true);
    window.setTimeout(
      () => window.removeEventListener("click", swallow, true),
      400,
    );
  }, []);

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
        suppressNextClick();
        cbRef.current();
      }, delayMs);
    },
    [enabled, delayMs, suppressNextClick],
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
