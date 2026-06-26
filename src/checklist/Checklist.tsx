// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { Checkbox } from "../components/Checkbox.tsx";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripIcon,
} from "../components/icons.tsx";
import {
  flattenForDisplay,
  sortCheckedToBottom,
  toggleNode,
  type ChecklistNode,
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
      {rows.map(({ node, depth, hasChildren }) => {
        const isCollapsed = collapsedSet.has(node.id);
        const label =
          checkboxLabel?.(node) ??
          (typeof node.label === "string" ? node.label : "Toggle item");
        return (
          <li
            key={node.id}
            className="flex items-center gap-3 border-b border-line py-2.5"
            style={{
              paddingLeft: depth ? depth * INDENT_PER_LEVEL : undefined,
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapsed(node.id)}
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

            <Checkbox
              checked={node.checked}
              onChange={() => onChange(toggleNode(items, node.id))}
              ariaLabel={label}
            />

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
                  onReorderStart
                    ? "cursor-grab hover:text-fg"
                    : "cursor-default"
                }`}
              >
                <GripIcon className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
