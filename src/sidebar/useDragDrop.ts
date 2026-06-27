// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// A headless, pointer-driven drag-and-drop primitive for navigation rows —
// the generic plumbing behind "drag a checklist into a folder", "drop a folder
// onto another workspace", "flick a row onto Archive". The host owns every
// domain decision (what a payload is, which drops are legal, what a drop *does*)
// and every pixel of chrome (the grab handle, the drop-zone highlight, the
// drag preview); this hook owns only the gesture: tracking the finger / cursor,
// hit-testing it against the registered drop zones, and firing `onDrop` with
// the dragged payload and the target it landed on.
//
// It is deliberately not HTML5 drag-and-drop: that API is mouse-only on the
// platforms these PWAs target (no touch on iOS Safari). Like the rest of the
// framework's gestures it rides Pointer Events, so the same drag works under a
// mouse, a pen, and a finger. A drag source captures the pointer on press, so
// the move/up stream keeps flowing to its handle even as the pointer travels
// across the panel; the hook reads each drop zone's live bounding box to decide
// what sits under the pointer rather than relying on the event target. A press
// that never travels past `threshold` is left untouched — it is a tap, and the
// handle's own click (if any) still fires.
//
// Two generics keep it honest: `TDrag` is what a source carries, `TTarget` is
// what a zone represents; `onDrop` and the optional `canDrop` guard see both,
// so neither the payloads nor the legality rules leak into the framework.

const DEFAULT_THRESHOLD = 6;

export interface DragDropOptions<TDrag, TTarget> {
  /** Fired once a dragged source is released over an accepting drop zone. */
  onDrop: (drag: TDrag, target: TTarget) => void;
  /**
   * Whether `drag` may land on `target`. A rejecting zone never lights up
   * (`isActive`/`isOver` stay false) and never receives a drop. Defaults to
   * accepting every zone.
   */
  canDrop?: (drag: TDrag, target: TTarget) => boolean;
  /** Pixels the pointer must travel before a press becomes a drag. Default 6. */
  threshold?: number;
  /** Notified when a real drag begins (past the threshold) and when it ends. */
  onDraggingChange?: (dragging: boolean) => void;
}

/** Pointer handlers + touch-action to spread onto a drag source (a grab handle). */
export interface DragHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  // A handle must own the pointer outright: without this a touch-drag scrolls
  // the list instead of streaming move events to the captured handle.
  style: { touchAction: "none" };
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
  startX: number;
  startY: number;
  payload: TDrag;
  moved: boolean;
}

export function useDragDrop<TDrag, TTarget>(
  options: DragDropOptions<TDrag, TTarget>,
): DragDrop<TDrag, TTarget> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  // Registered drop zones, keyed by the caller's id. The element arrives via the
  // ref callback; the target payload is refreshed on every render (a ref
  // callback only re-runs when the node changes, so it can't carry a value that
  // changes between renders).
  const zones = useRef(new Map<string, Zone<TTarget>>());
  // The in-flight gesture: null when idle, set on press, `moved` flips true once
  // it crosses the threshold and becomes a real drag.
  const gesture = useRef<Gesture<TDrag> | null>(null);
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

  function reset() {
    gesture.current = null;
    setDragging(null);
    setPointer(null);
    setOverId(null);
  }

  // Release on pointer-up: a real drag that ended over an accepting zone fires
  // `onDrop`. `dropped` distinguishes a genuine release (do the drop) from a
  // cancel (abort — the OS stole the pointer, an interrupting gesture, …).
  function finish(e: ReactPointerEvent<HTMLElement>, dropped: boolean) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    if (g.moved) {
      if (dropped) {
        const id = hitTest(e.clientX, e.clientY, g.payload);
        const zone = id ? zones.current.get(id) : null;
        if (zone) opts.current.onDrop(g.payload, zone.target);
      }
      opts.current.onDraggingChange?.(false);
    }
    reset();
  }

  function dragHandle(payload: TDrag): DragHandleProps {
    return {
      style: { touchAction: "none" },
      onPointerDown: (e) => {
        // Primary button / any touch or pen only.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        gesture.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          payload,
          moved: false,
        };
        // Capture so the move/up stream keeps reaching this handle even as the
        // pointer ranges across the panel (guarded — jsdom lacks the API).
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        const g = gesture.current;
        if (!g || e.pointerId !== g.pointerId) return;
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (!g.moved) {
          if (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold) return;
          g.moved = true;
          setDragging(g.payload);
          opts.current.onDraggingChange?.(true);
        }
        setPointer({ x: e.clientX, y: e.clientY });
        setOverId(hitTest(e.clientX, e.clientY, g.payload));
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

  return { dragging, pointer, dragHandle, dropZone };
}
