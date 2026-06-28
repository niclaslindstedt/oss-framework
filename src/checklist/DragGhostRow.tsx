// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { INDENT_PER_LEVEL } from "./row-layout.ts";

// The "ghost" preview shown while dragging a row: a dashed, accent-tinted copy
// of the dragged item snapped into the exact spot it will land. It sits in the
// list flow (so the surrounding rows open a gap for it) while the real dragged
// row floats, shrunken, under the finger. Non-interactive — purely a landing
// marker.
//
// When the item is about to become a **sub-item** (`depth > 0`, an "into" drop),
// the ghost reads as the child it will be: the dashed border itself is *indented*
// to where the nested row will sit (not just its content padded in), and the
// label + checkbox shrink to the smaller nested size — so a drop-to-nest is
// obvious before release. At depth 0 it spans the row full-width at full size,
// mirroring a sibling drop.
export function DragGhostRow({
  label,
  depth,
}: {
  // What the dragged row renders — its `ChecklistNode.label` (a string or any
  // node), shown muted inside the ghost.
  label: ReactNode;
  depth: number;
}) {
  const nested = depth > 0;
  const indent = depth * INDENT_PER_LEVEL;
  return (
    <li aria-hidden data-drag-ghost className="pointer-events-none py-0.5">
      <div
        // Indent the dashed border box itself (margin, not padding) so it starts
        // where the nested row will — the dotted outline lands at the child's
        // depth, making "this becomes a sub-item" unmistakable.
        style={{ marginLeft: indent || undefined }}
        className="flex items-center gap-3 rounded-md border-2 border-dashed border-accent bg-accent/10 px-2 py-2"
      >
        {/* Caret slot — a fixed-width spacer mirroring the row's disclosure
            caret column, so the checkbox aligns under the rows above. */}
        <span className="w-5 shrink-0" />
        <span
          className={`shrink-0 rounded-sm border-2 border-accent/60 ${
            nested ? "h-4 w-4" : "h-5 w-5"
          }`}
        />
        <span
          className={`min-w-0 flex-1 truncate text-left text-muted ${
            nested ? "text-xs" : "text-sm"
          }`}
        >
          {label}
        </span>
      </div>
    </li>
  );
}
