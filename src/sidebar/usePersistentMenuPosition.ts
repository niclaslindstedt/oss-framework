// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import { clampUnit, type MenuButtonPosition } from "./position.ts";

// Remembering where the user dragged the floating button is generic plumbing
// every app would otherwise re-implement: read the saved spot from
// `localStorage` on mount, write it back whenever a drag settles. `Sidebar` and
// `FloatingButton` stay deliberately controlled — the host still needs to own
// the value (it reads `position.side` for `useSidebarInset` and
// `useEdgeSwipeOpen`) — so this is not a prop on the component but a drop-in
// replacement for the `useState` an app would otherwise hold the position in: it
// returns the same `[position, onPositionChange]` pair, only backed by
// `localStorage[storageKey]` so the placement survives a reload.

const DEFAULT_POSITION: MenuButtonPosition = { side: "left", y: 0.5 };

// A stored value is only trusted when it has the shape we wrote — a bad/old
// entry (or a different app on the same key) falls back to the default rather
// than feeding a malformed position into the geometry.
function isStoredPosition(value: unknown): value is MenuButtonPosition {
  if (typeof value !== "object" || value === null) return false;
  const { side, y } = value as Record<string, unknown>;
  return (side === "left" || side === "right") && typeof y === "number";
}

function readStored(
  storageKey: string,
  fallback: MenuButtonPosition,
): MenuButtonPosition {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredPosition(parsed)) {
        return { side: parsed.side, y: clampUnit(parsed.y) };
      }
    }
  } catch {
    // Unreadable / malformed / storage blocked — fall through to the default.
  }
  return fallback;
}

/**
 * A `localStorage`-backed `[position, onPositionChange]` pair for the floating
 * button. Swap an app's `useState<MenuButtonPosition>(…)` for this and pass the
 * pair straight to `Sidebar` / `FloatingButton`; the spot the user drags it to
 * is then remembered across reloads under `storageKey`.
 */
export function usePersistentMenuPosition(
  storageKey: string,
  initial: MenuButtonPosition = DEFAULT_POSITION,
): [MenuButtonPosition, (next: MenuButtonPosition) => void] {
  const [position, setPosition] = useState<MenuButtonPosition>(() =>
    readStored(storageKey, initial),
  );

  const persist = useCallback(
    (next: MenuButtonPosition) => {
      setPosition(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage full / blocked (private mode) — keep the in-memory value.
      }
    },
    [storageKey],
  );

  return [position, persist];
}
