// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState, type ReactNode } from "react";

// One row in an action menu: a label, an optional leading glyph, the action
// it fires, and a `danger` flag that tints destructive rows (delete) red.
export type RowAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

// The list body shared by every floating action menu (`RowActionMenu`,
// `ContextMenu`): a focused `role="menu"` with arrow-key / Home / End /
// Enter / Space navigation, hover-follows-pointer highlighting, and the
// tinted `role="menuitem"` buttons. Renders inside a `FloatingPanel`, which
// owns the portal, dismissal, and positioning; this owns everything within.
// It mounts only while the panel is open, so the highlight state resets
// naturally between openings, and it grabs focus on mount so Escape and the
// arrow keys work without an extra click (the panel restores focus on
// close).
export function ActionMenuList({
  actions,
  ariaLabel,
  onActivate,
}: {
  actions: RowAction[];
  ariaLabel?: string;
  // Fires when a row is chosen (click or keyboard). The parent closes the
  // menu and runs the action — ordering it owns, since it owns the `open`
  // state.
  onActivate: (action: RowAction) => void;
}) {
  const [highlight, setHighlight] = useState(-1);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % actions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + actions.length) % actions.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlight(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlight(actions.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const action = actions[highlight];
        if (action) onActivate(action);
      }
    },
    [actions, highlight, onActivate],
  );

  return (
    <div
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      ref={(el) => {
        if (el) el.focus();
      }}
      className="outline-none"
    >
      {actions.map((action, i) => {
        const isHighlighted = i === highlight;
        return (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            onMouseEnter={() => setHighlight(i)}
            onClick={() => onActivate(action)}
            className={`flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm ${
              action.danger ? "text-danger" : "text-fg"
            } ${
              isHighlighted
                ? action.danger
                  ? "bg-danger/10"
                  : "bg-surface-3 text-fg-bright"
                : action.danger
                  ? "hover:bg-danger/10"
                  : "hover:bg-surface-3"
            }`}
          >
            {action.icon && <span className="shrink-0">{action.icon}</span>}
            <span className="flex-1 truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
