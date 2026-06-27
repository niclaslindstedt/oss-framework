// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { useLongPress } from "../hooks/useLongPress.ts";
import { FloatingPanel } from "./FloatingPanel.tsx";
import type { FloatingPlacement } from "./useFloatingPosition.ts";

// One row in the menu: a label, an optional leading glyph, the action it
// fires, and a `danger` flag that tints destructive rows (delete) red.
export type RowAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

// A row's secondary-action menu, summoned without a dedicated button: a
// desktop right-click or a touch long press over the wrapped row opens a small
// floating menu of its actions (rename, delete, …). It is the affordance an
// app reaches for when a row's primary tap already means something (navigate,
// expand) but it still needs a place to hang the less-common actions.
//
// Built on `FloatingPanel`, so it anchors to the row, portals to the body
// (escaping any transformed ancestor — a drawer carrying a `translateX`), and
// closes on Escape or an outside click. The long-press path comes from
// `useLongPress`, which also swallows the trailing tap so opening the menu
// never doubles as activating the row. `enabled` gates the whole thing off
// (a row with no actions, or a context where the gesture shouldn't apply).
const PLACEMENT: FloatingPlacement = {
  width: { kind: "max", maxPx: 240 },
  anchor: "left",
  coordinateSpace: "document",
};

export function RowActionMenu({
  actions,
  enabled = true,
  ariaLabel,
  longPressMs,
  children,
}: {
  actions: RowAction[];
  enabled?: boolean;
  ariaLabel?: string;
  // Override the hold time (ms) that opens the menu on touch.
  longPressMs?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = enabled && actions.length > 0;

  const openMenu = useCallback(() => {
    if (!active) return;
    setHighlight(-1);
    setOpen(true);
  }, [active]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      e.preventDefault();
      openMenu();
    },
    [active, openMenu],
  );

  const longPress = useLongPress(openMenu, {
    enabled: active,
    delayMs: longPressMs,
  });

  const activate = useCallback(
    (action: RowAction) => {
      close();
      action.onSelect();
    },
    [close],
  );

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
        if (action) activate(action);
      }
    },
    [actions, highlight, activate],
  );

  return (
    <div
      ref={wrapRef}
      onContextMenu={onContextMenu}
      // A long press is a held touch — without this the platform also fires its
      // own text selection / iOS callout under the finger, which fights the
      // menu the hold is opening. Kill both so the gesture stands alone.
      className="select-none [-webkit-touch-callout:none]"
      {...longPress}
    >
      {children}
      <FloatingPanel
        open={open && active}
        onClose={close}
        triggerRef={wrapRef}
        placement={PLACEMENT}
        className="py-1"
      >
        <div
          role="menu"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          // Focus the menu when it opens so Escape and arrow-key nav work
          // without an extra click (FloatingPanel restores focus on close).
          ref={(el) => {
            if (el && open) el.focus();
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
                onClick={() => activate(action)}
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
      </FloatingPanel>
    </div>
  );
}
