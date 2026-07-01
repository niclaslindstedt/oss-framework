// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ContextMenu,
  CopyIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

// The desktop counterpart to the touch swipe-to-delete: a small menu anchored
// at the cursor, opened by right-clicking a checklist row. The framework
// `Checklist` forwards the `contextmenu` event (gated on a real secondary
// click via `useDesktopPointer`) and the framework `ContextMenu` owns the
// chrome — the portal, the outside-click backdrop, Escape, viewport clamping,
// and the keyboard-navigable menu. The app owns what the right-click *means*:
// these two actions, run against its own store.
export type RowMenuTarget = { id: string; label: string; x: number; y: number };

type Props = {
  target: RowMenuTarget;
  onClose: () => void;
  onDelete: (id: string) => void;
};

export function RowContextMenu({ target, onClose, onDelete }: Props) {
  function copy() {
    void navigator.clipboard?.writeText(target.label).catch(() => {
      // Clipboard blocked (insecure context) — no-op for the demo.
    });
  }

  return (
    <ContextMenu
      position={target}
      onClose={onClose}
      ariaLabel="Item actions"
      actions={[
        {
          label: "Copy text",
          icon: <CopyIcon className="h-4 w-4" />,
          onSelect: copy,
        },
        {
          label: "Delete item",
          icon: <TrashIcon className="h-4 w-4" />,
          onSelect: () => onDelete(target.id),
          danger: true,
        },
      ]}
    />
  );
}
