// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

// The pure, DOM-free core of the nested checklist: a generic tree of
// checkable nodes and the operations over it. Every function is a pure
// transform — it returns a new tree and never mutates the input — so the
// component (and an app's own store) can derive state without a DOM and
// unit-test the behaviour cheaply.
//
// The node is intentionally minimal: an app layers its own fields (notes,
// tags, a template id, archived-ness) on top by intersecting this type, and
// passes a rich `label` (any `ReactNode`) for what the row renders.

export type ChecklistNode = {
  id: string;
  // What the row renders for this node. A string is the common case; any
  // `ReactNode` works (an icon + text, a styled span, …).
  label: ReactNode;
  checked: boolean;
  /**
   * When the node was last checked (ISO-8601), stamped by {@link toggleNode} /
   * {@link setAllChecked} on the false→true flip and cleared on uncheck. Drives
   * the "sort checked to the bottom" recency order (see
   * {@link sortCheckedToBottom}); absent while unchecked.
   */
  checkedAt?: string;
  /**
   * Nested sub-items (a "child checklist"). A parent's checked state cascades
   * to its whole subtree — checking a parent checks every descendant. Absent
   * (rather than an empty array) when a node is a leaf, so it round-trips
   * byte-for-byte.
   */
  children?: ChecklistNode[];
};

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

/** Depth-first flatten of the whole tree (parents before their children). */
export function flattenNodes(nodes: readonly ChecklistNode[]): ChecklistNode[] {
  const out: ChecklistNode[] = [];
  const walk = (list: readonly ChecklistNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Find a node by id anywhere in the tree, or `undefined`. */
export function findNode(
  nodes: readonly ChecklistNode[],
  id: string,
): ChecklistNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

// Rebuild the tree, replacing the node with `id` by `fn(node)`. Structural
// sharing everywhere else.
function updateNode(
  nodes: readonly ChecklistNode[],
  id: string,
  fn: (node: ChecklistNode) => ChecklistNode,
): ChecklistNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.children) {
      const children = updateNode(n.children, id, fn);
      if (children !== n.children) return { ...n, children };
    }
    return n;
  });
}

// Set a node and its whole subtree to `checked`, stamping/clearing `checkedAt`.
function applyChecked(
  node: ChecklistNode,
  checked: boolean,
  now: string,
): ChecklistNode {
  const next: ChecklistNode = checked
    ? { ...node, checked: true, checkedAt: now }
    : { ...node, checked: false };
  if (!checked) delete next.checkedAt;
  if (node.children)
    next.children = node.children.map((c) => applyChecked(c, checked, now));
  return next;
}

/**
 * Toggle the node with `id`: flip its `checked` and **cascade** the new value
 * down its whole subtree, so a checked-off group reads as done top to bottom.
 * Checking stamps `checkedAt`; unchecking clears it. Returns the input
 * unchanged if `id` isn't found.
 */
export function toggleNode(
  nodes: readonly ChecklistNode[],
  id: string,
  now?: string,
): ChecklistNode[] {
  const target = findNode(nodes, id);
  if (!target) return nodes as ChecklistNode[];
  const checked = !target.checked;
  return updateNode(nodes, id, (n) => applyChecked(n, checked, nowIso(now)));
}

/**
 * Set a single node's checked state to an explicit value (cascading the
 * subtree), without flipping. Useful when the caller already knows the target
 * state. No-op if `id` isn't found.
 */
export function setNodeChecked(
  nodes: readonly ChecklistNode[],
  id: string,
  checked: boolean,
  now?: string,
): ChecklistNode[] {
  if (!findNode(nodes, id)) return nodes as ChecklistNode[];
  return updateNode(nodes, id, (n) => applyChecked(n, checked, nowIso(now)));
}

/**
 * Check or uncheck **every** node in one sweep — the bulk action behind a
 * "check all / uncheck all" control. Returns the same tree untouched when
 * every node is already in the requested state.
 */
export function setAllChecked(
  nodes: readonly ChecklistNode[],
  checked: boolean,
  now?: string,
): ChecklistNode[] {
  if (!flattenNodes(nodes).some((n) => n.checked !== checked)) {
    return nodes as ChecklistNode[];
  }
  const stamp = nowIso(now);
  return nodes.map((n) => applyChecked(n, checked, stamp));
}

/**
 * Drop the node with `id` from the tree, wherever it sits — a top-level item or
 * a sub-item nested at any depth. Its whole subtree goes with it. Returns the
 * input unchanged if `id` isn't found. Pure: never mutates the input.
 */
export function removeNode(
  nodes: readonly ChecklistNode[],
  id: string,
): ChecklistNode[] {
  let changed = false;
  const next: ChecklistNode[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      changed = true;
      continue;
    }
    if (n.children) {
      const children = removeNode(n.children, id);
      if (children !== n.children) {
        changed = true;
        next.push({ ...n, children });
        continue;
      }
    }
    next.push(n);
  }
  return changed ? next : (nodes as ChecklistNode[]);
}

/**
 * Replace the label of the node with `id`, leaving its checked state, children,
 * and every other node untouched — the commit behind editing a row's text in
 * place. Returns the input unchanged (same ref) if `id` isn't found. Pure:
 * structural sharing everywhere else.
 */
export function renameNode(
  nodes: readonly ChecklistNode[],
  id: string,
  label: ReactNode,
): ChecklistNode[] {
  if (!findNode(nodes, id)) return nodes as ChecklistNode[];
  return updateNode(nodes, id, (n) => ({ ...n, label }));
}

// Insert `node` immediately before / after the node with `targetId`, wherever
// it sits in the tree, rebuilding only the path down to it (structural sharing
// elsewhere). Assumes `targetId` is present — the caller checks.
function insertRelative(
  nodes: readonly ChecklistNode[],
  targetId: string,
  node: ChecklistNode,
  position: "before" | "after",
): ChecklistNode[] {
  let changed = false;
  const out: ChecklistNode[] = [];
  for (const n of nodes) {
    if (n.id === targetId) {
      changed = true;
      if (position === "before") out.push(node, n);
      else out.push(n, node);
      continue;
    }
    if (n.children) {
      const children = insertRelative(n.children, targetId, node, position);
      if (children !== n.children) {
        changed = true;
        out.push({ ...n, children });
        continue;
      }
    }
    out.push(n);
  }
  return changed ? out : (nodes as ChecklistNode[]);
}

/**
 * Move the node with `dragId` to sit just `"before"` / `"after"` `targetId`,
 * wherever the target lives — reparenting the dragged node (and its whole
 * subtree) into the target's sibling list. The drop behind a drag-to-reorder
 * gesture. A no-op (same ref) when `dragId === targetId`, when either id is
 * missing, or when `targetId` sits inside `dragId`'s own subtree (which would
 * orphan the branch being relocated). Pure: never mutates the input.
 */
export function moveNode(
  nodes: readonly ChecklistNode[],
  dragId: string,
  targetId: string,
  position: "before" | "after",
): ChecklistNode[] {
  if (dragId === targetId) return nodes as ChecklistNode[];
  const dragged = findNode(nodes, dragId);
  if (!dragged || !findNode(nodes, targetId)) return nodes as ChecklistNode[];
  // Refuse to drop a node into its own subtree — it would vanish with the
  // branch we lift out below.
  if (dragged.children && findNode(dragged.children, targetId)) {
    return nodes as ChecklistNode[];
  }
  return insertRelative(removeNode(nodes, dragId), targetId, dragged, position);
}

/** Checked / total counts over every node in the tree (sub-items included). */
export function countProgress(nodes: readonly ChecklistNode[]): {
  checked: number;
  total: number;
} {
  const all = flattenNodes(nodes);
  return { checked: all.filter((n) => n.checked).length, total: all.length };
}

/** True when there is at least one node and every node is checked. */
export function isComplete(nodes: readonly ChecklistNode[]): boolean {
  const all = flattenNodes(nodes);
  return all.length > 0 && all.every((n) => n.checked);
}

/**
 * The checked state of a node's **subtree** for rendering an indeterminate
 * cue: `"checked"` when it and all descendants are checked, `"unchecked"` when
 * none are, `"mixed"` otherwise. (Toggling always cascades, so a `"mixed"`
 * parent only arises when descendants were toggled individually.)
 */
export function subtreeState(
  node: ChecklistNode,
): "checked" | "unchecked" | "mixed" {
  const all = flattenNodes([node]);
  const checked = all.filter((n) => n.checked).length;
  if (checked === 0) return "unchecked";
  if (checked === all.length) return "checked";
  return "mixed";
}

/**
 * Return the nodes with checked items sorted to the bottom of each sub-list
 * (most-recently-checked first within the checked group, by `checkedAt`),
 * applied recursively so the order holds inside every child checklist. Stable
 * for ties / missing timestamps, preserving document order.
 */
export function sortCheckedToBottom(
  nodes: readonly ChecklistNode[],
): ChecklistNode[] {
  const sorted = nodes.map((n) =>
    n.children ? { ...n, children: sortCheckedToBottom(n.children) } : n,
  );
  const unchecked = sorted.filter((n) => !n.checked);
  const checked = sorted.filter((n) => n.checked);
  checked.sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));
  return [...unchecked, ...checked];
}

/** One row in the flattened, depth-tagged view the list renders. */
export type DisplayRow = {
  node: ChecklistNode;
  /** Nesting depth — 0 for a top-level node, 1 for its child, and so on. */
  depth: number;
  /** Whether the node has sub-items (so the row shows an expand toggle). */
  hasChildren: boolean;
};

/**
 * Flatten a node tree into the ordered, depth-tagged rows a list renders. A
 * collapsed node (its id in `collapsed`) still appears, but its children are
 * skipped — the expand toggle reveals them. Pure, so the view derives its row
 * list without a DOM.
 */
export function flattenForDisplay(
  nodes: readonly ChecklistNode[],
  collapsed: ReadonlySet<string>,
): DisplayRow[] {
  const out: DisplayRow[] = [];
  const walk = (list: readonly ChecklistNode[], depth: number) => {
    for (const n of list) {
      const children = n.children ?? [];
      out.push({ node: n, depth, hasChildren: children.length > 0 });
      if (children.length > 0 && !collapsed.has(n.id)) {
        walk(children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return out;
}
