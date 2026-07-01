// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { useDesktopPointer } from "../hooks/useMediaQuery.ts";
import { useLongPress } from "../hooks/useLongPress.ts";
import { ActionMenuList, type RowAction } from "./ActionMenuList.tsx";
import { FloatingPanel } from "./FloatingPanel.tsx";
import type { FloatingPlacement } from "./useFloatingPosition.ts";

export type { RowAction };

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
  touchLongPress = true,
  children,
}: {
  actions: RowAction[];
  enabled?: boolean;
  ariaLabel?: string;
  // Override the hold time (ms) that opens the menu on touch.
  longPressMs?: number;
  // Whether a touch long press opens the menu. Hand it over (`false`) when the
  // row already spends its hold on another gesture — a long-press-to-drag, say
  // — leaving the desktop right-click as the menu's only opener. The touch
  // actions are expected to stay reachable another way (a swipe strip).
  touchLongPress?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The two entry points split by pointer: a real secondary (right) click opens
  // the menu on desktop, a long press opens it on touch. Each gesture is gated
  // to its own pointer so neither fires on the other's device — no long press
  // on a mouse, no synthesised right-click menu on a phone.
  const desktop = useDesktopPointer();

  const active = enabled && actions.length > 0;

  const openMenu = useCallback(() => {
    if (!active) return;
    setOpen(true);
  }, [active]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      // Always swallow the browser's native menu so it never covers the row.
      // Only a desktop pointer opens *our* menu from here; on touch the long
      // press owns opening it, and the platform-synthesised contextmenu a long
      // press emits would otherwise double-fire (or replace it) — so suppress
      // and stop.
      e.preventDefault();
      if (desktop) openMenu();
    },
    [active, desktop, openMenu],
  );

  // Long press is the touch counterpart to the desktop right-click — gate it to
  // touch so a held mouse button never opens the menu on desktop.
  const longPress = useLongPress(openMenu, {
    enabled: active && !desktop && touchLongPress,
    delayMs: longPressMs,
  });

  const activate = useCallback(
    (action: RowAction) => {
      close();
      action.onSelect();
    },
    [close],
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
        <ActionMenuList
          actions={actions}
          ariaLabel={ariaLabel}
          onActivate={activate}
        />
      </FloatingPanel>
    </div>
  );
}
