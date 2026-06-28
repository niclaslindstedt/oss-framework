// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { moveNode, type ChecklistNode } from "./tree.ts";

// Where a lifted row will land relative to the row it currently hovers.
export type DropIndicator = { id: string; position: "before" | "after" };

export interface ChecklistReorder {
  /** The id of the row currently lifted for dragging, or `null`. */
  draggingId: string | null;
  /** The drop the lifted row would commit on release, or `null`. */
  indicator: DropIndicator | null;
  /**
   * Lift the row with `id` for dragging — wire to a long press (touch) or a
   * grip press (pointer). Begins tracking the pointer at the window level until
   * release; a no-op while disabled or already dragging.
   */
  start: (id: string) => void;
  /**
   * Ref callback registering a row's element for hit-testing. Spread as
   * `ref={register(id)}` on each row; the callback is stable per id, so it
   * does not thrash the ref across renders.
   */
  register: (id: string) => (el: HTMLElement | null) => void;
}

// Headless reorder gesture for the nested checklist: lift a row (the caller
// fires `start` from a long press or a grip press), drag it over the list, and
// drop it before/after another row — at which point the hook computes the
// reordered tree with `moveNode` and hands it to `onChange`, the same channel a
// toggle commits through. It owns only the gesture and the live hit-test
// (reading each registered row's bounding box); the tree mechanics stay in
// `tree.ts` and persistence stays in the caller.
//
// Like the framework's other gestures it rides Pointer Events at the window
// level — so the move/up stream survives the pointer leaving the lifted row —
// and suppresses text selection while a drag is live. Disabled it is inert
// (`start` no-ops), so a caller can gate reordering off without unwiring it.
export function useChecklistReorder<T extends ChecklistNode>(
  items: T[],
  onChange: (next: T[]) => void,
  enabled: boolean,
): ChecklistReorder {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<DropIndicator | null>(null);

  // The window listeners read these through refs so the handlers stay stable
  // and never close over a stale tree / callback / drag state.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const draggingRef = useRef<string | null>(null);
  const indicatorRef = useRef<DropIndicator | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  // The live window handlers for the in-flight drag, so we detach the exact
  // instances we attached (and tear down on unmount mid-drag).
  const live = useRef<{
    move: (e: PointerEvent) => void;
    up: () => void;
    cancel: () => void;
  } | null>(null);

  // One stable ref callback per id — caching them keeps React from detaching
  // and reattaching every row's ref on each render.
  const registerCbs = useRef(
    new Map<string, (el: HTMLElement | null) => void>(),
  );
  const register = useCallback((id: string) => {
    let cb = registerCbs.current.get(id);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) rows.current.set(id, el);
        else rows.current.delete(id);
      };
      registerCbs.current.set(id, cb);
    }
    return cb;
  }, []);

  // Which registered row sits under `clientY`, and whether the pointer is in
  // its top or bottom half (→ drop before / after it). Reads each row's live
  // box, sorted top-down, so it is robust to the rows' DOM order.
  const hitTest = useCallback((clientY: number): DropIndicator | null => {
    const dragId = draggingRef.current;
    if (!dragId) return null;
    const boxes: { id: string; top: number; bottom: number }[] = [];
    for (const [id, el] of rows.current) {
      if (id === dragId) continue;
      const r = el.getBoundingClientRect();
      boxes.push({ id, top: r.top, bottom: r.bottom });
    }
    if (boxes.length === 0) return null;
    boxes.sort((a, b) => a.top - b.top);
    const first = boxes[0]!;
    const last = boxes[boxes.length - 1]!;
    if (clientY <= first.top) return { id: first.id, position: "before" };
    if (clientY >= last.bottom) return { id: last.id, position: "after" };
    for (const b of boxes) {
      if (clientY >= b.top && clientY <= b.bottom) {
        const mid = (b.top + b.bottom) / 2;
        return { id: b.id, position: clientY < mid ? "before" : "after" };
      }
    }
    return { id: last.id, position: "after" };
  }, []);

  const end = useCallback((commit: boolean) => {
    const h = live.current;
    if (h) {
      window.removeEventListener("pointermove", h.move);
      window.removeEventListener("pointerup", h.up);
      window.removeEventListener("pointercancel", h.cancel);
    }
    live.current = null;
    document.body.style.removeProperty("user-select");
    const dragId = draggingRef.current;
    const drop = indicatorRef.current;
    draggingRef.current = null;
    indicatorRef.current = null;
    setDraggingId(null);
    setIndicator(null);
    if (commit && dragId && drop) {
      const next = moveNode(itemsRef.current, dragId, drop.id, drop.position);
      if (next !== itemsRef.current) onChangeRef.current(next);
    }
  }, []);

  const start = useCallback(
    (id: string) => {
      if (!enabledRef.current || draggingRef.current) return;
      draggingRef.current = id;
      indicatorRef.current = null;
      setDraggingId(id);
      setIndicator(null);
      document.body.style.userSelect = "none";
      const move = (e: PointerEvent) => {
        // Non-passive: claim the move so a touch-drag reorders instead of
        // scrolling the list under the finger.
        e.preventDefault();
        const next = hitTest(e.clientY);
        indicatorRef.current = next;
        setIndicator(next);
      };
      const up = () => end(true);
      const cancel = () => end(false);
      live.current = { move, up, cancel };
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    },
    [hitTest, end],
  );

  // Tear down a drag still in flight when the list unmounts.
  useEffect(() => {
    return () => {
      const h = live.current;
      if (h) {
        window.removeEventListener("pointermove", h.move);
        window.removeEventListener("pointerup", h.up);
        window.removeEventListener("pointercancel", h.cancel);
      }
      document.body.style.removeProperty("user-select");
    };
  }, []);

  return { draggingId, indicator, start, register };
}
