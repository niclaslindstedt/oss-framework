// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { useTypeahead } from "./useTypeahead.ts";

const NO_LABELS: readonly string[] = [];

export type RovingOrientation = "vertical" | "horizontal";

export type RovingTabindexOptions = {
  // How many focusable items the list renders.
  itemCount: number;
  // Where the cursor seats when the surface becomes active — usually the
  // index of the currently selected option.
  initialIndex: number;
  // Toggle this when the surface containing the list is open / mounted /
  // focusable. On the false→true edge the cursor snaps back to
  // `initialIndex` (and focus moves there when `focusOnMove`); while false
  // the hook is dormant and forces no focus.
  active: boolean;
  // Which arrow-key axis walks the list. Defaults to "vertical".
  orientation?: RovingOrientation;
  // When true (default) the cursor wraps past the ends; otherwise it clamps.
  wrap?: boolean;
  // When true (default) the hook calls `.focus()` on the active item after
  // every cursor change — the listbox / menu pattern. Set false for a
  // radiogroup where Tab moves in / out and the arrows only shift a visual
  // cursor without stealing DOM focus.
  focusOnMove?: boolean;
  // One label per item, in item order, to opt the list into type-ahead: the
  // returned `onKeyDown` then jumps the cursor to the first item whose label
  // starts with what's been typed (see {@link useTypeahead}). Absent / empty
  // ⇒ no type-ahead.
  typeaheadLabels?: readonly string[];
};

export type RovingTabindex = {
  // The active item index. Wire `tabIndex={isCursorAt(i) ? 0 : -1}`.
  cursor: number;
  isCursorAt: (i: number) => boolean;
  // Ref callback to register each item, in order, so the hook can focus it.
  registerItem: (i: number) => (el: HTMLElement | null) => void;
  // Forward this to each item's `onKeyDown` (it handles both arrow nav and,
  // when `typeaheadLabels` is set, type-ahead).
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  // Imperatively focus the cursored item (e.g. after the surface paints).
  focusCursor: () => void;
  // Live type-ahead buffer ("" when idle / no type-ahead). Feed it to
  // {@link matchPrefixRange} on the cursored option to emphasise the match.
  typeaheadQuery: string;
};

// Roving tabindex for a flat 1-D list of focusable elements — the listbox /
// radiogroup / menubar pattern from the WAI-ARIA APG. The caller wires
// `tabIndex={isCursorAt(i) ? 0 : -1}` on each item, attaches `registerItem(i)`
// as a ref callback, and forwards `onKeyDown`. The hook moves focus on the
// orientation's arrow keys plus Home / End (wrapping at the ends), and bumps
// focus to `initialIndex` whenever `active` flips on so the first keypress
// lands somewhere sensible. For 2-D grids, see {@link useGridRovingTabindex}.
export function useRovingTabindex(opts: RovingTabindexOptions): RovingTabindex {
  const {
    itemCount,
    initialIndex,
    active,
    orientation = "vertical",
    wrap = true,
    focusOnMove = true,
    typeaheadLabels = NO_LABELS,
  } = opts;
  const [cursor, setCursor] = useState(initialIndex);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  // Re-seat the cursor on the initial index every time the surface becomes
  // active, then focus it on the next frame: the ref callback fires during
  // commit, but the item may not have painted yet on the first open.
  useEffect(() => {
    if (!active) return;
    const idx = Math.max(0, Math.min(initialIndex, itemCount - 1));
    setCursor(idx);
    if (!focusOnMove) return;
    const raf = requestAnimationFrame(() => {
      itemsRef.current[idx]?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [active, initialIndex, itemCount, focusOnMove]);

  const registerItem = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      itemsRef.current[i] = el;
    },
    [],
  );

  const moveTo = useCallback(
    (next: number) => {
      if (itemCount === 0) return;
      const bounded = wrap
        ? (next + itemCount) % itemCount
        : Math.max(0, Math.min(itemCount - 1, next));
      setCursor(bounded);
      if (focusOnMove) itemsRef.current[bounded]?.focus();
    },
    [itemCount, wrap, focusOnMove],
  );

  const {
    onKeyDown: onTypeaheadKeyDown,
    query: typeaheadQuery,
    reset: resetTypeahead,
  } = useTypeahead({ labels: typeaheadLabels, onMatch: moveTo });

  // Drop any in-progress buffer when the surface closes so re-opening starts a
  // fresh search with no leftover highlight.
  useEffect(() => {
    if (!active) resetTypeahead();
  }, [active, resetTypeahead]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prev = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      if (e.key === next) {
        e.preventDefault();
        resetTypeahead();
        moveTo(cursor + 1);
      } else if (e.key === prev) {
        e.preventDefault();
        resetTypeahead();
        moveTo(cursor - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        resetTypeahead();
        moveTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        resetTypeahead();
        moveTo(itemCount - 1);
      } else {
        onTypeaheadKeyDown(e);
      }
    },
    [
      cursor,
      itemCount,
      moveTo,
      orientation,
      onTypeaheadKeyDown,
      resetTypeahead,
    ],
  );

  const focusCursor = useCallback(() => {
    itemsRef.current[cursor]?.focus();
  }, [cursor]);

  const isCursorAt = useCallback((i: number) => i === cursor, [cursor]);

  return {
    cursor,
    isCursorAt,
    registerItem,
    onKeyDown,
    focusCursor,
    typeaheadQuery,
  };
}

export type GridRovingTabindexOptions = {
  itemCount: number;
  // How many columns the grid paints, reading left-to-right, top-to-bottom.
  // Must match the rendered layout (e.g. Tailwind `grid-cols-8` ⇒ `8`).
  columns: number;
  initialIndex: number;
  active: boolean;
  wrap?: boolean;
};

export type GridRovingTabindex = {
  cursor: number;
  isCursorAt: (i: number) => boolean;
  registerItem: (i: number) => (el: HTMLElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
};

// 2-D variant for grid pickers (a colour palette, a glyph grid). The list is
// laid out in `columns` columns reading left-to-right, top-to-bottom:
// ArrowLeft / ArrowRight walk the row, ArrowUp / ArrowDown jump a row, Home /
// End jump to the first / last cell.
export function useGridRovingTabindex(
  opts: GridRovingTabindexOptions,
): GridRovingTabindex {
  const { itemCount, columns, initialIndex, active, wrap = true } = opts;
  const [cursor, setCursor] = useState(initialIndex);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    const idx = Math.max(0, Math.min(initialIndex, itemCount - 1));
    setCursor(idx);
    const raf = requestAnimationFrame(() => {
      itemsRef.current[idx]?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [active, initialIndex, itemCount]);

  const registerItem = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      itemsRef.current[i] = el;
    },
    [],
  );

  const moveTo = useCallback(
    (next: number) => {
      if (itemCount === 0) return;
      const bounded = wrap
        ? (next + itemCount) % itemCount
        : Math.max(0, Math.min(itemCount - 1, next));
      setCursor(bounded);
      itemsRef.current[bounded]?.focus();
    },
    [itemCount, wrap],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(cursor + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveTo(cursor - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveTo(cursor + columns);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveTo(cursor - columns);
      } else if (e.key === "Home") {
        e.preventDefault();
        moveTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        moveTo(itemCount - 1);
      }
    },
    [cursor, columns, itemCount, moveTo],
  );

  const isCursorAt = useCallback((i: number) => i === cursor, [cursor]);

  return { cursor, isCursorAt, registerItem, onKeyDown };
}
