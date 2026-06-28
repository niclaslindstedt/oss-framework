// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

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
  removeNode,
  renameNode,
  sortCheckedToBottom,
  toggleNode,
  type ChecklistNode,
  type DisplayRow,
  type InsertPosition,
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
// swaps it for an inline field (focus + caret-at-end, Enter/blur commits, Escape
// cancels) and fires `onChange` with the relabelled tree. Pressing Enter on a
// row's editor commits it and — when `onAdd` is wired — opens a fresh draft row
// directly below it, so finishing one item flows straight into the next; and
// Backspace on an emptied row removes it and backs editing up into the line
// above, so holding Backspace walks up the list erasing blank rows.
//
// Pass `onAdd` (plus the controlled `composing` / `onComposingChange`) to give
// the list its own add-item composer: a draft row, rendered at the top or bottom
// per `addItemPosition`, that inserts via `onAdd` and stays open for the next
// entry on Enter. `onAdd` performs the insert (the caller owns the store) and
// returns the new node's id so the "Enter chains a new row" flow can re-anchor.
//
// Pass `reorderable` to make rows draggable: long-press a row (touch) or press
// its grip (`showGrips`) to lift it, drag it over the list, and drop it before
// or after another row — the component reorders the tree (`moveNode`) and fires
// `onChange`. The drop reparents into the target's sibling list, so a row can
// move between child checklists too.
//
// Pass `onDelete` and/or `swipeAction` to make rows swipeable (the
// {@link useRowSwipe} gesture both source apps grew): with both wired, swipe a
// row left to latch a Delete button open and right to flick it off to the
// caller-named commit (the `swipeAction` — an app might shelve/archive, defer,
// or file the row); with only `onDelete`, a right flick deletes too. Each fires
// with the row's id, so the caller owns the outcome (e.g. `removeNode`, or its
// own `updateNode`-based flag) and stacks it on its own undo history. The
// framework never names the commit — `swipeAction.label`/`.icon` caption it.
//
// Pass `isHidden` to drop a node (and its subtree) from the rendered rows while
// it stays in the tree — an app's "shelved"/archived flag, say, surfaced by a
// separate view. It's the caller's predicate; the framework owns no such flag.
//
// Pass `onRowContextMenu` to give desktop pointers a right-click handle on a
// row — the affordance touch users reach via the swipe. It fires with the
// row's id and the native `contextmenu` event (so the caller can position a
// menu at the cursor and `preventDefault` the browser's own menu). Gate it on
// a real secondary click yourself (`useDesktopPointer`) — `Checklist` only
// forwards the event.

type Props<T extends ChecklistNode> = {
  items: T[];
  // Receives the next tree after any in-place edit — a check toggle (cascade
  // applied), an inline label rename, or a drag-to-reorder. The app's node type
  // round-trips: the next tree carries the same `T` (with any app fields), not a
  // bare `ChecklistNode`.
  onChange: (next: T[]) => void;
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
  // user confirms a delete (taps the revealed Delete button, or — when no
  // `swipeAction` is wired — flicks the row off to the right). The caller
  // performs the actual removal.
  onDelete?: (id: string) => void;
  // When set, a right swipe flicks the row off to a caller-named commit, firing
  // `onCommit` with the row's id; the caller owns the outcome (shelve, defer,
  // file, …). `label`/`icon` caption the backdrop bared as the row slides — the
  // framework supplies no default (it doesn't name the action). With `onDelete`
  // also wired, the left swipe still reveals Delete.
  swipeAction?: {
    onCommit: (id: string) => void;
    label?: string;
    icon?: ReactNode;
  };
  // Drop a node (and its whole subtree) from the rendered rows and the progress
  // counts while it stays in the tree — e.g. an app's archived/shelved flag.
  // Omitted, every node shows.
  isHidden?: (node: T) => boolean;
  // Label on the revealed Delete button (English default; pass a translated
  // string). Unused unless `onDelete` is set.
  deleteLabel?: string;
  // Insert a new item into the tree at `position`, returning its id (or null
  // when nothing was added). The caller owns the store; wiring this turns on
  // the list's own composer and the "Enter on a row chains a new row" flow.
  onAdd?: (label: string, position: InsertPosition) => string | null;
  // Where the toolbar composer (the one `composing` opens) drops its items —
  // the top or the bottom of the list. Default "bottom".
  addItemPosition?: "top" | "bottom";
  // Placeholder + accessible label for the composer field (English default).
  addPlaceholder?: string;
  // Controlled open state of the toolbar composer (toggled by an app's add FAB).
  composing?: boolean;
  // Notified when the toolbar composer should close (a blur / Escape / an empty
  // Backspace). The caller flips `composing` off.
  onComposingChange?: (open: boolean) => void;
  // Called when a row is right-clicked (`contextmenu`), with the row's id and
  // the native event. The caller positions/opens its own menu and decides
  // whether to `preventDefault` the browser's. Best gated on a desktop pointer.
  onRowContextMenu?: (id: string, e: React.MouseEvent) => void;
  // Accessible-label builder for a row's checkbox; defaults to the node's
  // label when it is a string, else `"Toggle item"`.
  checkboxLabel?: (node: T) => string;
  // Controlled collapse: the set of collapsed (children-hidden) node ids.
  collapsed?: ReadonlySet<string>;
  onCollapsedChange?: (next: Set<string>) => void;
  className?: string;
};

const INDENT_PER_LEVEL = 22;

// Where a composer anchored to `anchorId` splices into the flattened rows: the
// index just past the anchor's whole subtree, so the new sibling lands below
// the anchor and any children it carries. -1 when the anchor isn't visible.
function indexPastSubtree(rows: DisplayRow[], anchorId: string): number {
  const idx = rows.findIndex((r) => r.node.id === anchorId);
  if (idx === -1) return -1;
  const depth = rows[idx]!.depth;
  let i = idx + 1;
  while (i < rows.length && rows[i]!.depth > depth) i++;
  return i;
}

export function Checklist<T extends ChecklistNode = ChecklistNode>({
  items,
  onChange,
  sinkChecked = false,
  editable = false,
  editPlaceholder = "Edit item",
  reorderable = false,
  showGrips = false,
  onReorderStart,
  onDelete,
  swipeAction,
  isHidden,
  deleteLabel = "Delete",
  onAdd,
  addItemPosition = "bottom",
  addPlaceholder = "Add item",
  composing = false,
  onComposingChange,
  onRowContextMenu,
  checkboxLabel,
  collapsed,
  onCollapsedChange,
  className = "",
}: Props<T>) {
  const [internalCollapsed, setInternalCollapsed] = useState<Set<string>>(
    () => new Set(),
  );
  const collapsedSet = collapsed ?? internalCollapsed;
  // Which row is being edited in place — one at a time, owned here so opening a
  // new editor closes the last.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The row a "type the next item right below this one" composer is anchored to
  // (opened by pressing Enter on a row's editor), or null when none is open.
  const [afterId, setAfterId] = useState<string | null>(null);
  // Bumped on every composer add so the draft field remounts empty and
  // refocused for the next entry.
  const [composerSeq, setComposerSeq] = useState(0);
  const reorder = useChecklistReorder(items, onChange, reorderable);

  // Opening the toolbar composer (the add FAB) stands down any in-place editor
  // or after-composer so only one draft is ever live.
  useEffect(() => {
    if (composing) {
      setEditingId(null);
      setAfterId(null);
    }
  }, [composing]);

  function toggleCollapsed(id: string) {
    const next = new Set(collapsedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
  }

  function startEdit(id: string) {
    setEditingId(id);
    setAfterId(null);
    if (composing) onComposingChange?.(false);
  }

  // Enter committed a row edit: open a fresh draft directly below it so a run of
  // entries walks straight down the list.
  function openAfter(id: string) {
    setEditingId(null);
    setAfterId(id);
    setComposerSeq((s) => s + 1);
    if (composing) onComposingChange?.(false);
  }

  // Backspace on an emptied editable row: remove it and move editing into the
  // row above (cursor at its end). Returns false at the top of the list.
  function backspaceEmpty(rows: DisplayRow[], id: string): boolean {
    const idx = rows.findIndex((r) => r.node.id === id);
    if (idx <= 0) return false;
    const prev = rows[idx - 1]!;
    if (typeof prev.node.label !== "string") return false;
    onChange(removeNode(items, id));
    setEditingId(prev.node.id);
    return true;
  }

  const display = sinkChecked ? sortCheckedToBottom(items) : items;
  const rows = flattenForDisplay(display, collapsedSet, isHidden);

  // Resolve the single live composer (after-anchored wins; else the toolbar
  // one) to a splice index and depth among the rows.
  let composerIndex = -1;
  let composerDepth = 0;
  let composerCommit: ((value: string, via: "enter" | "blur") => void) | null =
    null;
  let composerCancel: (() => void) | null = null;
  if (onAdd && afterId) {
    const idx = indexPastSubtree(rows, afterId);
    if (idx !== -1) {
      composerIndex = idx;
      composerDepth = rows.find((r) => r.node.id === afterId)?.depth ?? 0;
      composerCommit = (value, via) => {
        const newId = onAdd(value, { after: afterId });
        if (via === "enter") {
          if (newId) setAfterId(newId);
          setComposerSeq((s) => s + 1);
        } else {
          setAfterId(null);
        }
      };
      composerCancel = () => setAfterId(null);
    }
  } else if (onAdd && composing) {
    composerIndex = addItemPosition === "top" ? 0 : rows.length;
    composerCommit = (value, via) => {
      onAdd(value, { at: addItemPosition });
      if (via === "enter") setComposerSeq((s) => s + 1);
      else onComposingChange?.(false);
    };
    composerCancel = () => onComposingChange?.(false);
  }

  const rowEls = rows.map((row) => (
    <ChecklistRow
      key={row.node.id}
      row={row}
      isCollapsed={collapsedSet.has(row.node.id)}
      label={
        checkboxLabel?.(row.node) ??
        (typeof row.node.label === "string" ? row.node.label : "Toggle item")
      }
      editable={editable && typeof row.node.label === "string"}
      editPlaceholder={editPlaceholder}
      isEditing={editingId === row.node.id}
      onStartEdit={() => startEdit(row.node.id)}
      onCommitEdit={(text, via) => {
        onChange(renameNode(items, row.node.id, text));
        if (via === "enter" && onAdd) openAfter(row.node.id);
        else setEditingId(null);
      }}
      onCancelEdit={() => setEditingId(null)}
      onBackspaceEmpty={() => backspaceEmpty(rows, row.node.id)}
      reorderable={reorderable}
      reorder={reorder}
      showGrips={showGrips}
      onReorderStart={onReorderStart}
      onToggle={() => onChange(toggleNode(items, row.node.id))}
      onToggleCollapsed={() => toggleCollapsed(row.node.id)}
      onDelete={onDelete ? () => onDelete(row.node.id) : undefined}
      swipeAction={
        swipeAction
          ? {
              onCommit: () => swipeAction.onCommit(row.node.id),
              label: swipeAction.label,
              icon: swipeAction.icon,
            }
          : undefined
      }
      deleteLabel={deleteLabel}
      onContextMenu={
        onRowContextMenu
          ? (e: React.MouseEvent) => onRowContextMenu(row.node.id, e)
          : undefined
      }
    />
  ));

  if (composerIndex >= 0 && composerCommit && composerCancel) {
    rowEls.splice(
      composerIndex,
      0,
      <ComposerRow
        key={`composer-${composerSeq}`}
        depth={composerDepth}
        placeholder={addPlaceholder}
        onCommit={composerCommit}
        onCancel={composerCancel}
      />,
    );
  }

  return <ul className={`flex flex-col ${className}`.trim()}>{rowEls}</ul>;
}

// The add-item composer's draft row — a row-shaped shell (caret slot + an inert
// preview checkbox) around an empty {@link InlineEditField}. Keyed on a sequence
// the list bumps after each add, so it remounts blank and refocused for the next
// entry. Caret-at-end (it's empty anyway), Enter commits and keeps it open via
// the `via` argument, blur / Escape / empty-Backspace close it.
function ComposerRow({
  depth,
  placeholder,
  onCommit,
  onCancel,
}: {
  depth: number;
  placeholder: string;
  onCommit: (value: string, via: "enter" | "blur") => void;
  onCancel: () => void;
}) {
  return (
    <li
      className="relative flex items-center gap-3 border-b border-line py-2.5"
      style={{ paddingLeft: depth ? depth * INDENT_PER_LEVEL : undefined }}
    >
      <span aria-hidden className="w-5 shrink-0" />
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 rounded-sm border-2 border-muted opacity-60"
      />
      <InlineEditField
        initial=""
        placeholder={placeholder}
        ariaLabel={placeholder}
        selectOnFocus={false}
        onCommit={onCommit}
        onCancel={onCancel}
        onBackspaceEmpty={() => {
          onCancel();
          return true;
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-muted/60"
      />
    </li>
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
  onCommitEdit: (text: string, via: "enter" | "blur") => void;
  onCancelEdit: () => void;
  onBackspaceEmpty?: () => boolean;
  reorderable: boolean;
  reorder: ChecklistReorder;
  showGrips: boolean;
  onReorderStart?: (id: string, e: ReactPointerEvent) => void;
  onToggle: () => void;
  onToggleCollapsed: () => void;
  onDelete?: () => void;
  swipeAction?: RowSwipeAction;
  deleteLabel: string;
  onContextMenu?: (e: React.MouseEvent) => void;
};

// A right-swipe "flick-off" commit on a row, already bound to the row's id —
// the caller names it (`label`/`icon`); the framework supplies no default.
type RowSwipeAction = {
  onCommit: () => void;
  label?: string;
  icon?: ReactNode;
};

// One row — the shell (plain or swipeable) plus its lift gesture and drop cue.
// Lives as its own component so it can call the per-row hooks (`useLongPress`)
// the list can't call in a loop.
function ChecklistRow(props: RowProps) {
  const { row, reorder, reorderable, isEditing, onDelete, swipeAction } = props;
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

  if (onDelete || swipeAction) {
    return (
      <SwipeRow
        depth={row.depth}
        onDelete={onDelete}
        swipeAction={swipeAction}
        deleteLabel={props.deleteLabel}
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
  onBackspaceEmpty,
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
          // Tap-to-edit continues the existing text — drop the caret at the end
          // rather than selecting the whole label.
          selectOnFocus={false}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
          onBackspaceEmpty={onBackspaceEmpty}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-muted/60"
        />
      ) : editable ? (
        // Tap-to-edit: a button so it's keyboard-reachable and announces as
        // actionable; a long press (lift) suppresses its click, so dragging
        // never opens the editor. `select-none` keeps a tap from selecting the
        // label text (and, on mobile, popping the platform selection / zoom).
        <button
          type="button"
          onClick={onStartEdit}
          className={`min-w-0 flex-1 truncate text-left text-sm select-none ${labelTone}`}
        >
          {node.label}
        </button>
      ) : (
        <span className={`flex-1 truncate text-sm select-none ${labelTone}`}>
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

// Swipeable row shell. A left swipe latches a Delete strip open behind the
// sliding foreground; a right swipe flicks the row off — to the caller-named
// `swipeAction` commit when wired (its `label`/`icon` captioning the backdrop
// bared as it slides), else firing `onDelete` (the right-flick delete). The
// foreground carries an opaque background so the strips stay hidden until the
// row is swiped their way.
function SwipeRow({
  depth,
  onDelete,
  swipeAction,
  deleteLabel,
  onContextMenu,
  registerRef,
  liftHandlers,
  rowClassName = "",
  indicator,
  children,
}: {
  depth: number;
  onDelete?: () => void;
  swipeAction?: RowSwipeAction;
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
  // Swipe-to-act is a touch affordance; a desktop pointer reaches the same
  // actions through the right-click menu the caller wires via
  // `onRowContextMenu`. Gate the gesture off there so a mouse drag never latches
  // a row open.
  const desktop = useDesktopPointer();
  // Right swipe (leading) flicks to the caller-named commit when offered, else
  // deletes; left swipe (trailing) reveals the Delete button when a delete is
  // offered.
  const swipe = useRowSwipe(undefined, {
    enabled: !desktop,
    leading: swipeAction
      ? { intent: "commit", onCommit: swipeAction.onCommit }
      : onDelete
        ? { intent: "commit", onCommit: onDelete }
        : undefined,
    trailing: onDelete ? { intent: "reveal", width: 96 } : undefined,
  });
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
      {/* Commit backdrop, bared as the foreground slides right. Only present
          when a `swipeAction` is wired; hidden until the row is swiped its way
          so it never flashes the wrong direction. The caller supplies its
          glyph / caption — the framework names nothing here. */}
      {swipeAction && (
        <div
          aria-hidden={swipe.offset <= 0}
          className={`absolute inset-0 flex items-center justify-start gap-2 bg-accent px-4 text-xs font-semibold tracking-wide text-page-bg uppercase ${
            swipe.offset > 0 ? "" : "invisible"
          }`}
        >
          {swipeAction.icon}
          {swipeAction.label && <span>{swipeAction.label}</span>}
        </div>
      )}
      {/* Delete strip, uncovered as the foreground slides left. */}
      {onDelete && (
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
      )}

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
