// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type PointerEvent as ReactPointerEvent } from "react";

import { Checkbox } from "../components/Checkbox.tsx";
import { InlineEditField } from "../components/InlineEditField.tsx";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripIcon,
} from "../components/icons.tsx";
import { useDesktopPointer } from "../hooks/useMediaQuery.ts";
import { useLongPress, type LongPressHandlers } from "../hooks/useLongPress.ts";
import { useRowSwipe } from "../hooks/useRowSwipe.ts";
import {
  flattenForDisplay,
  renameNode,
  sortCheckedToBottom,
  toggleNode,
  type ChecklistNode,
  type DisplayRow,
} from "./tree.ts";
import {
  useChecklistReorder,
  type ChecklistReorder,
} from "./useChecklistReorder.ts";

// A nested, checkable list — the checklist screen's body, as a reusable
// component. It renders a tree of {@link ChecklistNode}s as depth-indented
// rows: each row a {@link Checkbox}, the node's label (struck through when
// checked), an expand/collapse caret for a node with children (a "child
// checklist"), and an optional drag-handle grip. Checking a parent cascades
// to its whole subtree (see {@link toggleNode}).
//
// Controlled: pass `items` and an `onChange` that receives the next tree. Every
// in-place edit the component makes — a check toggle, an inline label rename, a
// drag-to-reorder — flows back through `onChange`, so the caller owns one commit
// channel (and stacks them on its own undo history). The expand/collapse state
// is internal (the rows are a pure projection of the tree, so the framework owns
// that ephemeral view state) unless the caller drives it via `collapsed` /
// `onCollapsedChange`.
//
// Pass `editable` to make a row's text editable in place: tapping a string label
// swaps it for an inline field (focus + select, Enter/blur commits, Escape
// cancels) and fires `onChange` with the relabelled tree.
//
// Pass `reorderable` to make rows draggable: long-press a row (touch) or press
// its grip (`showGrips`) to lift it, drag it over the list, and drop it before
// or after another row — the component reorders the tree (`moveNode`) and fires
// `onChange`. The drop reparents into the target's sibling list, so a row can
// move between child checklists too.
//
// Pass `onDelete` to make rows swipeable (the {@link useRowSwipe} gesture both
// source apps grew): swipe a row left to latch a Delete button open, or right
// to flick it away — either fires `onDelete` with the row's id. The caller owns
// the removal (e.g. `removeNode`), so it can stack it on its own undo history.
//
// Pass `onRowContextMenu` to give desktop pointers a right-click handle on a
// row — the affordance touch users reach via the swipe. It fires with the
// row's id and the native `contextmenu` event (so the caller can position a
// menu at the cursor and `preventDefault` the browser's own menu). Gate it on
// a real secondary click yourself (`useDesktopPointer`) — `Checklist` only
// forwards the event.

type Props = {
  items: ChecklistNode[];
  // Receives the next tree after any in-place edit — a check toggle (cascade
  // applied), an inline label rename, or a drag-to-reorder.
  onChange: (next: ChecklistNode[]) => void;
  // Sort checked items to the bottom of each sub-list for display (the
  // ordering is view-only — `onChange` never persists it).
  sinkChecked?: boolean;
  // Make a row's string label editable in place: tapping it opens an inline
  // field; a commit fires `onChange` with the relabelled tree. Non-string
  // labels (a rich `ReactNode`) stay read-only.
  editable?: boolean;
  // Placeholder + accessible label for the inline edit field (English default;
  // pass a translated string). Unused unless `editable` is set.
  editPlaceholder?: string;
  // Make rows draggable: a long press (or a grip press, with `showGrips`) lifts
  // a row; dropping it before/after another row fires `onChange` with the
  // reordered tree.
  reorderable?: boolean;
  // Render a drag-handle grip at the end of each row. With `reorderable` the
  // grip starts the drag; otherwise it's a visual affordance you wire via
  // `onReorderStart`.
  showGrips?: boolean;
  // Called with a row's node id when its grip is pressed (pointer-down), for a
  // caller driving its own drag. Ignored when `reorderable` owns the grip.
  onReorderStart?: (id: string, e: ReactPointerEvent) => void;
  // When set, rows become swipeable and this fires with a row's id once the
  // user confirms a delete (taps the revealed Delete button, or flicks the row
  // off to the right). The caller performs the actual removal.
  onDelete?: (id: string) => void;
  // Label on the revealed Delete button (English default; pass a translated
  // string). Unused unless `onDelete` is set.
  deleteLabel?: string;
  // Called when a row is right-clicked (`contextmenu`), with the row's id and
  // the native event. The caller positions/opens its own menu and decides
  // whether to `preventDefault` the browser's. Best gated on a desktop pointer.
  onRowContextMenu?: (id: string, e: React.MouseEvent) => void;
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
  editable = false,
  editPlaceholder = "Edit item",
  reorderable = false,
  showGrips = false,
  onReorderStart,
  onDelete,
  deleteLabel = "Delete",
  onRowContextMenu,
  checkboxLabel,
  collapsed,
  onCollapsedChange,
  className = "",
}: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState<Set<string>>(
    () => new Set(),
  );
  const collapsedSet = collapsed ?? internalCollapsed;
  // Which row is being edited in place — one at a time, owned here so opening a
  // new editor closes the last.
  const [editingId, setEditingId] = useState<string | null>(null);
  const reorder = useChecklistReorder(items, onChange, reorderable);

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
      {rows.map((row) => (
        <ChecklistRow
          key={row.node.id}
          row={row}
          isCollapsed={collapsedSet.has(row.node.id)}
          label={
            checkboxLabel?.(row.node) ??
            (typeof row.node.label === "string"
              ? row.node.label
              : "Toggle item")
          }
          editable={editable && typeof row.node.label === "string"}
          editPlaceholder={editPlaceholder}
          isEditing={editingId === row.node.id}
          onStartEdit={() => setEditingId(row.node.id)}
          onCommitEdit={(text) => {
            onChange(renameNode(items, row.node.id, text));
            setEditingId(null);
          }}
          onCancelEdit={() => setEditingId(null)}
          reorderable={reorderable}
          reorder={reorder}
          showGrips={showGrips}
          onReorderStart={onReorderStart}
          onToggle={() => onChange(toggleNode(items, row.node.id))}
          onToggleCollapsed={() => toggleCollapsed(row.node.id)}
          onDelete={onDelete ? () => onDelete(row.node.id) : undefined}
          deleteLabel={deleteLabel}
          onContextMenu={
            onRowContextMenu
              ? (e: React.MouseEvent) => onRowContextMenu(row.node.id, e)
              : undefined
          }
        />
      ))}
    </ul>
  );
}

type RowProps = {
  row: DisplayRow;
  isCollapsed: boolean;
  label: string;
  editable: boolean;
  editPlaceholder: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
  reorderable: boolean;
  reorder: ChecklistReorder;
  showGrips: boolean;
  onReorderStart?: (id: string, e: ReactPointerEvent) => void;
  onToggle: () => void;
  onToggleCollapsed: () => void;
  onDelete?: () => void;
  deleteLabel: string;
  onContextMenu?: (e: React.MouseEvent) => void;
};

// One row — the shell (plain or swipeable) plus its lift gesture and drop cue.
// Lives as its own component so it can call the per-row hooks (`useLongPress`)
// the list can't call in a loop.
function ChecklistRow(props: RowProps) {
  const { row, reorder, reorderable, isEditing, onDelete, deleteLabel } = props;
  const id = row.node.id;
  // Long-press lifts the row — but only while reordering is on and we're not
  // editing its text (a held caret in the field must not start a drag).
  const longPress = useLongPress(() => reorder.start(id), {
    enabled: reorderable && !isEditing,
  });
  const liftHandlers = reorderable && !isEditing ? longPress : undefined;
  const dragging = reorder.draggingId === id;
  const ind = reorder.indicator;
  const dropBefore = ind?.id === id && ind.position === "before";
  const dropAfter = ind?.id === id && ind.position === "after";

  const inner = <RowInner {...props} />;
  const indicatorEls = (
    <>
      {dropBefore && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-accent"
        />
      )}
      {dropAfter && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-accent"
        />
      )}
    </>
  );
  const dragClass = dragging ? "opacity-60" : "";

  if (onDelete) {
    return (
      <SwipeRow
        depth={row.depth}
        onDelete={onDelete}
        deleteLabel={deleteLabel}
        onContextMenu={props.onContextMenu}
        registerRef={reorder.register(id)}
        liftHandlers={liftHandlers}
        rowClassName={dragClass}
        indicator={indicatorEls}
      >
        {inner}
      </SwipeRow>
    );
  }
  return (
    <li
      ref={reorder.register(id)}
      data-dragging={dragging || undefined}
      className={`relative flex items-center gap-3 border-b border-line py-2.5 ${dragClass}`.trim()}
      style={{
        paddingLeft: row.depth ? row.depth * INDENT_PER_LEVEL : undefined,
      }}
      onContextMenu={props.onContextMenu}
      {...liftHandlers}
    >
      {indicatorEls}
      {inner}
    </li>
  );
}

// The flex children of one row — caret slot, checkbox, label (or its inline
// editor), optional grip. Shared verbatim between the plain and swipeable row
// shells so the row reads identically whichever wraps it.
function RowInner({
  row,
  isCollapsed,
  label,
  editable,
  editPlaceholder,
  isEditing,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  reorderable,
  reorder,
  showGrips,
  onReorderStart,
  onToggle,
  onToggleCollapsed,
}: RowProps) {
  const { node, hasChildren } = row;
  const labelTone = node.checked ? "text-muted line-through" : "text-fg";
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

      {isEditing ? (
        <InlineEditField
          initial={typeof node.label === "string" ? node.label : ""}
          placeholder={editPlaceholder}
          ariaLabel={editPlaceholder}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-muted/60"
        />
      ) : editable ? (
        // Tap-to-edit: a button so it's keyboard-reachable and announces as
        // actionable; a long press (lift) suppresses its click, so dragging
        // never opens the editor.
        <button
          type="button"
          onClick={onStartEdit}
          className={`min-w-0 flex-1 truncate text-left text-sm ${labelTone}`}
        >
          {node.label}
        </button>
      ) : (
        <span className={`flex-1 truncate text-sm ${labelTone}`}>
          {node.label}
        </span>
      )}

      {showGrips && (
        <button
          type="button"
          aria-label="Reorder"
          onPointerDown={(e) => {
            if (reorderable) {
              // The grip is an explicit handle — start the drag at once, and
              // stop the press from also arming the row's long-press hold.
              e.stopPropagation();
              reorder.start(node.id);
            } else {
              onReorderStart?.(node.id, e);
            }
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-muted ${
            reorderable || onReorderStart
              ? "cursor-grab hover:text-fg"
              : "cursor-default"
          }`}
        >
          <GripIcon className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

// Compose the swipe gesture's pointer handlers with the row's lift (long-press)
// handlers so a single element drives both — a horizontal drift swipes, a held
// press lifts (the long-press cancels itself the moment a swipe travels).
function composeHandlers(
  swipe: ReturnType<typeof useRowSwipe>["handlers"],
  lift: LongPressHandlers | undefined,
) {
  if (!lift) return swipe;
  return {
    ...swipe,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      swipe.onPointerDown(e);
      lift.onPointerDown(e);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      swipe.onPointerMove(e);
      lift.onPointerMove(e);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      swipe.onPointerUp(e);
      lift.onPointerUp(e);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
      swipe.onPointerCancel(e);
      lift.onPointerCancel(e);
    },
    onPointerLeave: lift.onPointerLeave,
  };
}

// Swipeable row shell. A Delete action strip sits behind a sliding foreground;
// `useRowSwipe` drives the transform and both outcomes (latch-open / flick-off)
// land on `onDelete`. The foreground carries an opaque background so the strip
// stays hidden until the row is swiped its way.
function SwipeRow({
  depth,
  onDelete,
  deleteLabel,
  onContextMenu,
  registerRef,
  liftHandlers,
  rowClassName = "",
  indicator,
  children,
}: {
  depth: number;
  onDelete: () => void;
  deleteLabel: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  // Registers the measurable row element with the reorder hit-test.
  registerRef: (el: HTMLElement | null) => void;
  // The row's long-press lift handlers, merged with the swipe handlers.
  liftHandlers?: LongPressHandlers;
  // Extra row classes (e.g. the lifted-row dim).
  rowClassName?: string;
  // The drop-position cue, rendered into the (relative) outer shell.
  indicator?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Swipe-to-delete is a touch affordance; a desktop pointer deletes through
  // the right-click menu the caller wires via `onRowContextMenu`. Gate the
  // gesture off there so a mouse drag never latches the Delete strip open.
  const desktop = useDesktopPointer();
  const swipe = useRowSwipe(onDelete, { enabled: !desktop });
  const paddingLeft = depth ? depth * INDENT_PER_LEVEL : undefined;
  if (desktop) {
    return (
      <li
        ref={registerRef}
        className={`relative flex items-center gap-3 border-b border-line py-2.5 ${rowClassName}`.trim()}
        style={{ paddingLeft }}
        onContextMenu={onContextMenu}
        {...liftHandlers}
      >
        {indicator}
        {children}
      </li>
    );
  }
  return (
    <li className="relative overflow-hidden border-b border-line">
      {indicator}
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
        ref={registerRef}
        {...composeHandlers(swipe.handlers, liftHandlers)}
        onContextMenu={onContextMenu}
        style={{
          transform: `translateX(${swipe.offset}px)`,
          paddingLeft,
        }}
        className={`flex items-center gap-3 bg-page-bg py-2.5 [touch-action:pan-y] ${
          swipe.animating ? "transition-transform duration-200" : ""
        } ${rowClassName}`.trim()}
      >
        {children}
      </div>
    </li>
  );
}
