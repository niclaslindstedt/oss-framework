// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ActionMenuList, type RowAction } from "./ActionMenuList.tsx";
import { FloatingPanel } from "./FloatingPanel.tsx";
import type {
  FloatingPlacement,
  FloatingPoint,
} from "./useFloatingPosition.ts";

// A cursor-anchored action menu — the desktop counterpart to a row's touch
// gestures, opened wherever the app catches a `contextmenu` event (a
// right-click on a row, a canvas, a header). The component owns all the
// chrome that used to be every adopter's job: the body portal, the
// outside-click backdrop, Escape-to-close, viewport clamping (the menu never
// spills off the right or bottom edge — near the bottom it flips above the
// cursor), the `role="menu"` keyboard navigation, and the tinted menu items
// shared with `RowActionMenu`. The app owns what a right-click *means*: it
// supplies the `actions` (labels, glyphs, handlers) and the `position`, and
// clears the position on close.
//
// Controlled by `position`: pass the pointer's `clientX` / `clientY` to
// open, `null` to close. `onClose` fires on Escape, outside click, or after
// an action is chosen — the caller sets its position state back to `null`.
const PLACEMENT: FloatingPlacement = {
  // Content-driven width with the familiar context-menu floor.
  width: { kind: "min", minPx: 192 },
  anchor: "left",
  gap: 2,
  coordinateSpace: "viewport",
};

export function ContextMenu({
  position,
  actions,
  onClose,
  ariaLabel,
}: {
  // Viewport coordinates of the invoking pointer event, or `null` when
  // closed.
  position: FloatingPoint | null;
  actions: RowAction[];
  onClose: () => void;
  ariaLabel?: string;
}) {
  const open = position !== null && actions.length > 0;
  return (
    <FloatingPanel
      open={open}
      onClose={onClose}
      anchorPoint={position ?? { x: 0, y: 0 }}
      placement={PLACEMENT}
      className="py-1"
    >
      <ActionMenuList
        actions={actions}
        ariaLabel={ariaLabel}
        onActivate={(action) => {
          onClose();
          action.onSelect();
        }}
      />
    </FloatingPanel>
  );
}
