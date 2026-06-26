// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, type AriaAttributes, type ReactNode } from "react";

import type { MenuButtonPosition } from "./position.ts";
import { useDraggableMenuButton } from "./useDraggableMenuButton.ts";

// The draggable floating action button extracted from `Sidebar`, where it lived
// inline as the navigation toggle. It is the round, edge-resting button an app
// pins over its content for a single global action the user reaches from
// anywhere on a phone — opening the navigation drawer, opening Settings, etc.
//
// It owns only the button: the host supplies the icon (`children`), the press
// handler (`onPress`), the persisted resting `position`, and the accessible
// `label`. The user can drag it to either side edge; `useDraggableMenuButton`
// snaps it to the nearer edge on release and the host persists the new
// `position` through `onPositionChange`. A press that never crossed the drag
// threshold is a tap and fires `onPress` (the drag hook swallows the click that
// tails a real drag, leaving keyboard activation untouched).
//
// Multiple instances coexist — each carries its own `position` — so an app can
// float, say, a menu button on the left and a settings button on the right from
// the same primitive. Styling rides on the host's CSS-variable token system
// (`bg-surface` / `border-line` / `text-muted`), matching the rest of the
// framework's components.

export type FloatingButtonProps = {
  /** The button's persisted resting position (edge + vertical fraction). */
  position: MenuButtonPosition;
  /** Persist a new resting position after the user drags the button. */
  onPositionChange: (next: MenuButtonPosition) => void;
  /** A genuine tap (not the tail of a drag) — the button's action. */
  onPress: () => void;
  /**
   * Notified while the button is mid-drag, so the host can suppress competing
   * global gestures (e.g. pull-to-refresh) for its duration.
   */
  onDraggingChange?: (dragging: boolean) => void;
  /** Accessible label — the button's only content is an icon. */
  label: string;
  /** `aria-expanded` for a button that toggles an overlay (menu / dialog). */
  expanded?: boolean;
  /** `aria-controls` — the id of the overlay this button controls, when open. */
  controls?: string;
  /** `aria-haspopup` — the kind of overlay the press opens. */
  haspopup?: AriaAttributes["aria-haspopup"];
  /** The icon rendered inside the button. */
  children: ReactNode;
};

export function FloatingButton({
  position,
  onPositionChange,
  onPress,
  onDraggingChange,
  label,
  expanded,
  controls,
  haspopup,
  children,
}: FloatingButtonProps) {
  const drag = useDraggableMenuButton(position, onPositionChange);

  // Mirror the live drag state up so the host can gate global gestures off
  // while the button is being dragged.
  useEffect(() => {
    onDraggingChange?.(drag.dragging);
  }, [drag.dragging, onDraggingChange]);

  return (
    <button
      type="button"
      onClick={() => {
        if (drag.consumeDragClick()) return;
        onPress();
      }}
      {...drag.handlers}
      style={drag.style}
      aria-haspopup={haspopup}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      className={`fixed z-40 flex h-11 w-11 touch-none items-center justify-center rounded-full border border-line bg-surface text-muted shadow-lg select-none hover:text-fg-bright ${
        drag.dragging
          ? "cursor-grabbing transition-none"
          : "cursor-grab transition-[left,top] duration-300 ease-out"
      }`}
    >
      {children}
    </button>
  );
}
