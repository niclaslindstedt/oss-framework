// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createPortal } from "react-dom";

import {
  CopyIcon,
  DismissBackdrop,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks";

// The desktop counterpart to the touch swipe-to-delete: a small menu anchored
// at the cursor, opened by right-clicking a checklist row. The app owns it —
// the framework `Checklist` only forwards the `contextmenu` event (gated on a
// real secondary click via `useDesktopPointer`); here the demo positions and
// renders the actual menu and runs the actions against its own store.
//
// Dismissal reuses the framework's own primitives: `DismissBackdrop` catches a
// tap outside (and swallows the trailing events so the click doesn't fall
// through), and `useEscapeKey` closes on Escape.
export type RowMenuTarget = { id: string; label: string; x: number; y: number };

type Props = {
  target: RowMenuTarget;
  onClose: () => void;
  onDelete: (id: string) => void;
};

export function RowContextMenu({ target, onClose, onDelete }: Props) {
  useEscapeKey(true, onClose);

  function copy() {
    void navigator.clipboard?.writeText(target.label).catch(() => {
      // Clipboard blocked (insecure context) — no-op for the demo.
    });
    onClose();
  }

  function remove() {
    onDelete(target.id);
    onClose();
  }

  return createPortal(
    <>
      <DismissBackdrop onDismiss={onClose} />
      <div
        role="menu"
        aria-label="Item actions"
        // Pin near the cursor, clamped a little inside the viewport edges so the
        // ~12rem menu never spills off the right/bottom.
        style={{
          left: Math.min(target.x, window.innerWidth - 200),
          top: Math.min(target.y, window.innerHeight - 96),
        }}
        className="fixed z-[60] min-w-[12rem] overflow-hidden rounded-md border border-line bg-surface-1 py-1 text-sm shadow-lg"
      >
        <MenuItem onClick={copy}>
          <CopyIcon className="h-4 w-4" />
          Copy text
        </MenuItem>
        <MenuItem onClick={remove} tone="danger">
          <TrashIcon className="h-4 w-4" />
          Delete item
        </MenuItem>
      </div>
    </>,
    document.body,
  );
}

function MenuItem({
  children,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger hover:bg-danger/10"
      : "text-fg hover:bg-surface-2";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left ${toneClass}`}
    >
      {children}
    </button>
  );
}
