// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Moving a dialog out of the way of the thing it is about.
//
// Most dialogs sit over content they have nothing to do with, and where they
// sit is a matter of taste. Some don't: a dialog that previews onto the page
// behind it, or names a row you have to keep reading, makes its own position a
// real question — a card over the middle of the screen is a card over the
// answer. A stylesheet can drop it to one edge, and on most screens that is
// enough, but "most" is doing a lot of work: a wide landscape picture with the
// interesting part along the bottom, a portrait page on a laptop, an
// adjustment being judged on something in the lower third. There is no
// arrangement that is right every time, so the dialog stops guessing and lets
// the user move it: grab its title row and drag, and it stays where it was put
// for as long as it is open.
//
// **It moves the card rather than replacing it.** The hook is attached to a
// grip — the dialog's own heading row — and finds the card by walking up from
// there (`closest('[role="dialog"]')`), so it works with any dialog that
// carries the role, `Modal` included, with nothing threaded through the
// component. The offset is written as two custom properties rather than as an
// inline transform, because `Modal` writes `style.transform` itself while a
// swipe-to-close is in flight and two owners of one property is a bug waiting
// to happen; `Modal` reads these into its `translate`, which is a separate
// property that composes with it.
//
// It is a pointer affordance and it says so. Pass `enabled: false` on the
// widths where the card is the whole screen — there is nothing to drag it
// clear of and nowhere to drag it to — and it recentres itself rather than
// stranding an offset nothing can now change.

/** How much of the card must stay on screen, in CSS pixels. A card dragged
 *  entirely off the window is one you cannot get back without closing it. */
const KEEP_ON_SCREEN = 48;

/** One arrow key's worth of movement, for a card moved from the keyboard. */
const NUDGE = 24;

export type DialogDrag = {
  /** Goes on the grab handle — the dialog's own title row. */
  gripRef: (element: HTMLElement | null) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
  /** Whether it has been moved at all, so the dialog can offer the way back
   *  only once there is somewhere to go back from. */
  moved: boolean;
  /** Put it back where it opened. */
  recentre: () => void;
};

export function useDialogDrag(enabled = true): DialogDrag {
  const gripEl = useRef<HTMLElement | null>(null);
  const at = useRef({ x: 0, y: 0 });
  const from = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const [moved, setMoved] = useState(false);

  const card = () =>
    gripEl.current?.closest<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    ) ?? null;

  /** Write the offset onto the card, clamped so it can always be grabbed
   *  again. The clamp is computed from where the card *would* be with no
   *  offset at all, which is its own rect less whatever is currently
   *  applied. */
  const place = useCallback((x: number, y: number) => {
    const element = card();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const base = {
      left: rect.left - at.current.x,
      top: rect.top - at.current.y,
    };
    // Sideways: enough of the card left on screen to grab. Downward: the same.
    // *Upward* is the asymmetric one — the grip is the card's own title row, so
    // a card whose top edge has gone off the top of the window is one nothing
    // can drag back. The top edge therefore stays on screen, full stop.
    const across = Math.min(
      window.innerWidth - KEEP_ON_SCREEN - base.left,
      Math.max(KEEP_ON_SCREEN - base.left - rect.width, x),
    );
    const down = Math.min(
      window.innerHeight - KEEP_ON_SCREEN - base.top,
      Math.max(-base.top, y),
    );
    const next = { x: across, y: down };
    at.current = next;
    element.style.setProperty("--dialog-drag-x", `${next.x}px`);
    element.style.setProperty("--dialog-drag-y", `${next.y}px`);
    setMoved(next.x !== 0 || next.y !== 0);
  }, []);

  const recentre = useCallback(() => {
    const element = card();
    at.current = { x: 0, y: 0 };
    element?.style.removeProperty("--dialog-drag-x");
    element?.style.removeProperty("--dialog-drag-y");
    setMoved(false);
  }, []);

  // A width that can no longer offer the drag — a phone turned upright, a
  // window narrowed — has the card back where it started rather than stranded
  // at an offset nothing can now change.
  useEffect(() => {
    if (!enabled) recentre();
  }, [enabled, recentre]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      // Not a press on something *in* the title row that does its own thing.
      if (
        (e.target as Element)?.closest("button, a, input, select, textarea")
      ) {
        return;
      }
      e.preventDefault();
      const grip = gripEl.current;
      grip?.setPointerCapture?.(e.pointerId);
      from.current = {
        x: e.clientX,
        y: e.clientY,
        ox: at.current.x,
        oy: at.current.y,
      };
      const move = (m: PointerEvent) => {
        const start = from.current;
        if (!start) return;
        place(
          start.ox + (m.clientX - start.x),
          start.oy + (m.clientY - start.y),
        );
      };
      const done = () => {
        from.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", done);
        window.removeEventListener("pointercancel", done);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", done);
      window.addEventListener("pointercancel", done);
    },
    [enabled, place],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (!enabled) return;
      const step = e.shiftKey ? NUDGE * 2 : NUDGE;
      const by: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = by[e.key];
      if (!delta) return;
      e.preventDefault();
      place(at.current.x + delta[0], at.current.y + delta[1]);
    },
    [enabled, place],
  );

  const gripRef = useCallback((element: HTMLElement | null) => {
    gripEl.current = element;
  }, []);

  return { gripRef, onPointerDown, onKeyDown, moved, recentre };
}
