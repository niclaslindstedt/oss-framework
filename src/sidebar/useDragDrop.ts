// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// A headless, pointer-driven drag-and-drop primitive for navigation rows —
// the generic plumbing behind "drag a checklist into a folder", "drop a folder
// onto another workspace", "flick a row onto Archive". The host owns every
// domain decision (what a payload is, which drops are legal, what a drop *does*)
// and every pixel of chrome (the drop-zone highlight, the drag preview); this
// hook owns only the gesture: recognising it, tracking the finger / cursor,
// hit-testing it against the registered drop zones, and firing `onDrop` with
// the dragged payload and the target it landed on.
//
// The source is the *whole row*, not a dedicated grab handle — there's no grip
// to spend a column on. It splits the gesture by pointer the way the platform
// does, so the row never needs a separate affordance:
//   • Mouse / pen — a plain press-and-drag. Travel past `threshold` turns the
//     press into a drag; a press that never moves stays a click (the row's tap).
//   • Touch — press-and-hold. A drag only begins after the finger is held in
//     place for `longPressMs`; any travel before then is a scroll or a swipe and
//     abandons the press, so the row's vertical scroll and its own swipe gesture
//     still win. Once the hold picks the row up, the move stream drags it and a
//     trailing tap is swallowed so the drop never also activates the row.
//
// It is deliberately not HTML5 drag-and-drop: that API is mouse-only on the
// platforms these PWAs target (no touch on iOS Safari). Like the rest of the
// framework's gestures it rides Pointer Events, so the same drag works under a
// mouse, a pen, and a finger. Once a drag begins the source captures the
// pointer, so the move/up stream keeps flowing even as the pointer travels
// across the panel; the hook reads each drop zone's live bounding box to decide
// what sits under the pointer rather than relying on the event target.
//
// Two generics keep it honest: `TDrag` is what a source carries, `TTarget` is
// what a zone represents; `onDrop` and the optional `canDrop` guard see both,
// so neither the payloads nor the legality rules leak into the framework.

const DEFAULT_THRESHOLD = 6;
const DEFAULT_LONG_PRESS_MS = 400;
// How far (px²) a held finger may drift before the press is read as a scroll /
// swipe and the pending drag is abandoned. Squared so the move test skips a
// square root. Generous enough to ignore the jitter of a resting finger.
const TOUCH_SLOP_SQ = 10 * 10;

export interface DragDropOptions<TDrag, TTarget> {
  /** Fired once a dragged source is released over an accepting drop zone. */
  onDrop: (drag: TDrag, target: TTarget) => void;
  /**
   * Whether `drag` may land on `target`. A rejecting zone never lights up
   * (`isActive`/`isOver` stay false) and never receives a drop. Defaults to
   * accepting every zone.
   */
  canDrop?: (drag: TDrag, target: TTarget) => boolean;
  /** Pixels a mouse / pen must travel before a press becomes a drag. Default 6. */
  threshold?: number;
  /**
   * How long (ms) a finger must stay down before a touch press picks the row
   * up. Matches the platform long-press convention. Default 400.
   */
  longPressMs?: number;
  /** Notified when a real drag begins (the source is lifted) and when it ends. */
  onDraggingChange?: (dragging: boolean) => void;
}

/** Pointer handlers + touch-action to spread onto a drag source (the whole row). */
export interface DragHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  // `pan-y` keeps the list scrolling under a finger and a sideways swipe owned
  // by the row — a press that scrolls or swipes never becomes a drag. Once the
  // hold lifts the row the hook blocks the scroll itself for the drag's span.
  style: { touchAction: "pan-y" };
}

/** Ref + live state to spread onto a drop zone element. */
export interface DropZoneProps {
  /** Attach to the zone's element so the hook can read its live bounding box. */
  ref: (el: HTMLElement | null) => void;
  /** The pointer is currently over this zone and it accepts the active drag. */
  isOver: boolean;
  /** A drag this zone would accept is in flight (cue every legal target). */
  isActive: boolean;
}

export interface DragDrop<TDrag, TTarget> {
  /** The payload being dragged right now, or null when idle. */
  dragging: TDrag | null;
  /** The live pointer position while dragging (for a cursor-following preview). */
  pointer: { x: number; y: number } | null;
  /** Props for a drag source carrying `payload`. */
  dragHandle: (payload: TDrag) => DragHandleProps;
  /** Props for a drop zone identified by `id` representing `target`. */
  dropZone: (id: string, target: TTarget) => DropZoneProps;
}

interface Zone<TTarget> {
  el: HTMLElement | null;
  target: TTarget;
}

interface Gesture<TDrag> {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  payload: TDrag;
  // The source element, kept so the long-press timer can capture the pointer
  // and a release can hand it back without an event in hand.
  el: HTMLElement;
  // A real drag is underway (the row is lifted) — distinct from a press still
  // deciding whether it's a tap, a scroll, or a drag.
  moved: boolean;
  // The pending touch long-press timer, or null (a mouse press, or once fired).
  timer: number | null;
}

export function useDragDrop<TDrag, TTarget>(
  options: DragDropOptions<TDrag, TTarget>,
): DragDrop<TDrag, TTarget> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const longPressMs = options.longPressMs ?? DEFAULT_LONG_PRESS_MS;

  // Registered drop zones, keyed by the caller's id. The element arrives via the
  // ref callback; the target payload is refreshed on every render (a ref
  // callback only re-runs when the node changes, so it can't carry a value that
  // changes between renders).
  const zones = useRef(new Map<string, Zone<TTarget>>());
  // The in-flight gesture: null when idle, set on press, `moved` flips true once
  // it becomes a real drag (mouse past the threshold, or a touch hold elapsed).
  const gesture = useRef<Gesture<TDrag> | null>(null);
  // The non-passive `touchmove` blocker installed for a live touch drag, so the
  // finger dragging a row never also scrolls the panel under it. Held here so it
  // can be removed on release / cancel / unmount.
  const scrollBlock = useRef<((e: TouchEvent) => void) | null>(null);
  // Latest option callbacks, reachable from the (re-created each render)
  // handlers without widening their dependencies.
  const opts = useRef(options);
  opts.current = options;

  const [dragging, setDragging] = useState<TDrag | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // The id of the smallest registered zone whose box contains the point and
  // accepts the drag. Smallest-wins so a folder zone nested inside a "root" zone
  // claims the drop when the pointer is over the folder.
  function hitTest(x: number, y: number, drag: TDrag): string | null {
    let bestId: string | null = null;
    let bestArea = Infinity;
    const { canDrop } = opts.current;
    for (const [id, zone] of zones.current) {
      if (!zone.el) continue;
      const r = zone.el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (canDrop && !canDrop(drag, zone.target)) continue;
      const area = (r.right - r.left) * (r.bottom - r.top);
      if (area < bestArea) {
        bestArea = area;
        bestId = id;
      }
    }
    return bestId;
  }

  // Stop the panel scrolling under a live touch drag. `touch-action` was settled
  // as `pan-y` when the finger landed (so a quick drag could still scroll), so
  // the only way to hold it still now is to swallow the moves outright.
  function blockScroll() {
    if (scrollBlock.current) return;
    const handler = (e: TouchEvent) => e.preventDefault();
    scrollBlock.current = handler;
    window.addEventListener("touchmove", handler, { passive: false });
  }
  function unblockScroll() {
    if (!scrollBlock.current) return;
    window.removeEventListener("touchmove", scrollBlock.current);
    scrollBlock.current = null;
  }

  function reset() {
    const g = gesture.current;
    if (g?.timer != null) window.clearTimeout(g.timer);
    gesture.current = null;
    unblockScroll();
    setDragging(null);
    setPointer(null);
    setOverId(null);
  }

  // Lift the row: the press has become a real drag. Capture the pointer so the
  // move/up stream keeps reaching the source as it ranges across the panel, and
  // — for a finger — pin the panel still and give a small pickup buzz.
  function beginDrag(g: Gesture<TDrag>, x: number, y: number) {
    if (g.timer != null) {
      window.clearTimeout(g.timer);
      g.timer = null;
    }
    g.moved = true;
    // Guarded — jsdom lacks the Pointer Capture API.
    g.el.setPointerCapture?.(g.pointerId);
    if (g.pointerType !== "mouse") {
      blockScroll();
      navigator.vibrate?.(15);
    }
    setDragging(g.payload);
    setPointer({ x, y });
    setOverId(hitTest(x, y, g.payload));
    opts.current.onDraggingChange?.(true);
  }

  // After a real drag the same pointer still emits a trailing `click` on the
  // row underneath — catch it once in the capture phase and stop it, so a drop
  // never also fires the row's tap (navigate). Self-removes after the click (or
  // shortly after, if the platform emits none).
  function suppressNextClick() {
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
  }

  // Release on pointer-up: a real drag that ended over an accepting zone fires
  // `onDrop`. `dropped` distinguishes a genuine release (do the drop) from a
  // cancel (abort — the OS stole the pointer, an interrupting gesture, …).
  function finish(e: ReactPointerEvent<HTMLElement>, dropped: boolean) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.el.hasPointerCapture?.(e.pointerId)) {
      g.el.releasePointerCapture?.(e.pointerId);
    }
    if (g.moved) {
      if (dropped) {
        const id = hitTest(e.clientX, e.clientY, g.payload);
        const zone = id ? zones.current.get(id) : null;
        if (zone) opts.current.onDrop(g.payload, zone.target);
      }
      // A press that became a drag must not also count as the row's tap.
      suppressNextClick();
      opts.current.onDraggingChange?.(false);
    }
    reset();
  }

  function dragHandle(payload: TDrag): DragHandleProps {
    return {
      style: { touchAction: "pan-y" },
      onPointerDown: (e) => {
        // Primary button / any touch or pen only; ignore a second pointer while
        // a gesture is already live.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (gesture.current) return;
        const g: Gesture<TDrag> = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          startX: e.clientX,
          startY: e.clientY,
          payload,
          el: e.currentTarget,
          moved: false,
          timer: null,
        };
        gesture.current = g;
        // Touch / pen arm a hold; a mouse waits for the threshold instead, so a
        // press that never moves stays the row's click.
        if (e.pointerType !== "mouse") {
          g.timer = window.setTimeout(() => {
            if (gesture.current !== g) return;
            beginDrag(g, g.startX, g.startY);
          }, longPressMs);
        }
      },
      onPointerMove: (e) => {
        const g = gesture.current;
        if (!g || e.pointerId !== g.pointerId) return;
        if (g.moved) {
          setPointer({ x: e.clientX, y: e.clientY });
          setOverId(hitTest(e.clientX, e.clientY, g.payload));
          return;
        }
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (g.pointerType === "mouse") {
          // Below the threshold it's still a click in waiting.
          if (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold) return;
          beginDrag(g, e.clientX, e.clientY);
        } else if (dx * dx + dy * dy > TOUCH_SLOP_SQ) {
          // Travel before the hold elapses is a scroll or a swipe — abandon the
          // press so that gesture proceeds untouched.
          window.clearTimeout(g.timer ?? undefined);
          gesture.current = null;
        }
      },
      onPointerUp: (e) => finish(e, true),
      onPointerCancel: (e) => finish(e, false),
    };
  }

  function dropZone(id: string, target: TTarget): DropZoneProps {
    // Keep the target current. Writing to the ref during render is safe here —
    // it stores a value, triggers no render, and is idempotent under a double
    // (StrictMode) invocation.
    const existing = zones.current.get(id);
    if (existing) existing.target = target;
    else zones.current.set(id, { el: null, target });
    const { canDrop } = opts.current;
    const isActive =
      dragging !== null && (!canDrop || canDrop(dragging, target));
    return {
      isOver: overId === id,
      isActive,
      ref: (el) => {
        const entry = zones.current.get(id);
        if (el) {
          if (entry) entry.el = el;
          else zones.current.set(id, { el, target });
        } else if (entry) {
          // Unmounted — forget its stale box. A still-mounted zone re-registers
          // on the next render.
          zones.current.delete(id);
        }
      },
    };
  }

  // Drop a pending hold and any scroll block if the host unmounts mid-gesture.
  useEffect(() => {
    return () => {
      if (gesture.current?.timer != null) {
        window.clearTimeout(gesture.current.timer);
      }
      if (scrollBlock.current) {
        window.removeEventListener("touchmove", scrollBlock.current);
        scrollBlock.current = null;
      }
    };
  }, []);

  return { dragging, pointer, dragHandle, dropZone };
}
