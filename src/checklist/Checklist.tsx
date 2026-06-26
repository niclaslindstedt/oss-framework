// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { Checkbox } from "../components/Checkbox.tsx";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripIcon,
} from "../components/icons.tsx";
import { useRowSwipe } from "../hooks/useRowSwipe.ts";
import {
  flattenForDisplay,
  sortCheckedToBottom,
  toggleNode,
  type ChecklistNode,
  type DisplayRow,
} from "./tree.ts";

// A nested, checkable list — the checklist screen's body, as a reusable
// component. It renders a tree of {@link ChecklistNode}s as depth-indented
// rows: each row a {@link Checkbox}, the node's label (struck through when
// checked), an expand/collapse caret for a node with children (a "child
// checklist"), and an optional drag-handle grip. Checking a parent cascades
// to its whole subtree (see {@link toggleNode}).
//
// Controlled: pass `items` and an `onChange` that receives the next tree. The
// expand/collapse state is internal (the rows are a pure projection of the
// tree, so the framework owns that ephemeral view state) unless the caller
// drives it via `collapsed` / `onCollapsedChange`.
//
// Pass `onDelete` to make rows swipeable (the {@link useRowSwipe} gesture both
// source apps grew): swipe a row left to latch a Delete button open, or right
// to flick it away — either fires `onDelete` with the row's id. The caller owns
// the removal (e.g. `removeNode`), so it can stack it on its own undo history.

type Props = {
  items: ChecklistNode[];
  // Receives the next tree after a check toggles (cascade applied).
  onChange: (next: ChecklistNode[]) => void;
  // Sort checked items to the bottom of each sub-list for display (the
  // ordering is view-only — `onChange` never persists it).
  sinkChecked?: boolean;
  // Render a drag-handle grip at the end of each row. Visual affordance only;
  // wire `onReorderStart` to begin your own drag.
  showGrips?: boolean;
  // Called with a row's node id when its grip is pressed (pointer-down).
  onReorderStart?: (id: string, e: React.PointerEvent) => void;
  // When set, rows become swipeable and this fires with a row's id once the
  // user confirms a delete (taps the revealed Delete button, or flicks the row
  // off to the right). The caller performs the actual removal.
  onDelete?: (id: string) => void;
  // Label on the revealed Delete button (English default; pass a translated
  // string). Unused unless `onDelete` is set.
  deleteLabel?: string;
  // Accessible-label builder for a row's checkbox; defaults to the node's
  // label when it is a string, else `"Toggle item"`.
  checkboxLabel?: (node: ChecklistNode) => string;
  // Controlled collapse: the set of collapsed (children-hidden) node ids.
  collapsed?: ReadonlySet<string>;
  onCollapsedChange?: (next: Set<string>) => void;
  className?: string;
};

const INDENT_PER_LEVEL = 22;

export function Checklist({
  items,
  onChange,
  sinkChecked = false,
  showGrips = false,
  onReorderStart,
  onDelete,
  deleteLabel = "Delete",
  checkboxLabel,
  collapsed,
  onCollapsedChange,
  className = "",
}: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState<Set<string>>(
    () => new Set(),
  );
  const collapsedSet = collapsed ?? internalCollapsed;

  function toggleCollapsed(id: string) {
    const next = new Set(collapsedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
  }

  const display = sinkChecked ? sortCheckedToBottom(items) : items;
  const rows = flattenForDisplay(display, collapsedSet);

  return (
    <ul className={`flex flex-col ${className}`.trim()}>
      {rows.map((row) => {
        const inner = (
          <RowInner
            row={row}
            isCollapsed={collapsedSet.has(row.node.id)}
            label={
              checkboxLabel?.(row.node) ??
              (typeof row.node.label === "string"
                ? row.node.label
                : "Toggle item")
            }
            showGrips={showGrips}
            onReorderStart={onReorderStart}
            onToggle={() => onChange(toggleNode(items, row.node.id))}
            onToggleCollapsed={() => toggleCollapsed(row.node.id)}
          />
        );
        return onDelete ? (
          <SwipeRow
            key={row.node.id}
            depth={row.depth}
            onDelete={() => onDelete(row.node.id)}
            deleteLabel={deleteLabel}
          >
            {inner}
          </SwipeRow>
        ) : (
          <li
            key={row.node.id}
            className="flex items-center gap-3 border-b border-line py-2.5"
            style={{
              paddingLeft: row.depth ? row.depth * INDENT_PER_LEVEL : undefined,
            }}
          >
            {inner}
          </li>
        );
      })}
    </ul>
  );
}

// The flex children of one row — caret slot, checkbox, label, optional grip.
// Shared verbatim between the plain and swipeable row shells so the row reads
// identically whichever wraps it.
function RowInner({
  row,
  isCollapsed,
  label,
  showGrips,
  onReorderStart,
  onToggle,
  onToggleCollapsed,
}: {
  row: DisplayRow;
  isCollapsed: boolean;
  label: string;
  showGrips: boolean;
  onReorderStart?: (id: string, e: React.PointerEvent) => void;
  onToggle: () => void;
  onToggleCollapsed: () => void;
}) {
  const { node, hasChildren } = row;
  return (
    <>
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!isCollapsed}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span aria-hidden className="w-5 shrink-0" />
      )}

      <Checkbox checked={node.checked} onChange={onToggle} ariaLabel={label} />

      <span
        className={`flex-1 truncate text-sm ${
          node.checked ? "text-muted line-through" : "text-fg"
        }`}
      >
        {node.label}
      </span>

      {showGrips && (
        <button
          type="button"
          aria-label="Reorder"
          onPointerDown={(e) => onReorderStart?.(node.id, e)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-muted ${
            onReorderStart ? "cursor-grab hover:text-fg" : "cursor-default"
          }`}
        >
          <GripIcon className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

// Swipeable row shell. A Delete action strip sits behind a sliding foreground;
// `useRowSwipe` drives the transform and both outcomes (latch-open / flick-off)
// land on `onDelete`. The foreground carries an opaque background so the strip
// stays hidden until the row is swiped its way.
function SwipeRow({
  depth,
  onDelete,
  deleteLabel,
  children,
}: {
  depth: number;
  onDelete: () => void;
  deleteLabel: string;
  children: React.ReactNode;
}) {
  const swipe = useRowSwipe(onDelete);
  const paddingLeft = depth ? depth * INDENT_PER_LEVEL : undefined;
  return (
    <li className="relative overflow-hidden border-b border-line">
      {/* Delete strip, uncovered as the foreground slides left. Hidden while
          the row sits closed so it's never bared mid-gesture the other way. */}
      <div
        aria-hidden={swipe.offset >= 0}
        className={`absolute inset-0 flex items-center justify-end ${
          swipe.offset < 0 ? "" : "invisible"
        }`}
      >
        <button
          type="button"
          onClick={onDelete}
          className="h-full w-24 bg-danger text-xs font-semibold tracking-wide text-white uppercase"
        >
          {deleteLabel}
        </button>
      </div>

      <div
        {...swipe.handlers}
        style={{
          transform: `translateX(${swipe.offset}px)`,
          paddingLeft,
        }}
        className={`flex items-center gap-3 bg-page-bg py-2.5 [touch-action:pan-y] ${
          swipe.animating ? "transition-transform duration-200" : ""
        }`}
      >
        {children}
      </div>
    </li>
  );
}
