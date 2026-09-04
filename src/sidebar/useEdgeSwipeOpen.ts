// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { isModalOpen } from "../hooks/isModalOpen.ts";
import {
  classifyEdgeDrag,
  inEdgeZone,
  EDGE_OPEN_DISTANCE_PX,
  EDGE_ZONE_PX,
} from "./edgeSwipe.ts";
import type { MenuButtonSide } from "./position.ts";

// Touch-driven "swipe in from the screen edge to open the drawer" gesture —
// the counterpart to `useDrawerSwipeClose`, and the replacement for the
// floating menu button when an app hides it. A document-level touch listener,
// gated by an `enabled` flag, that fires once a deliberate gesture completes.
//
// A press that starts within `edgeZone` of the relevant border and then
// travels inward (rightward from the left edge, leftward from the right edge)
// past `openDistance` — while staying more horizontal than vertical, so it
// doesn't fight a scroll — calls `onOpen`. The edge it watches is the drawer's
// resting `side`, so the gesture always pulls the panel in from where it lives.
//
// Touch-only by design: an edge swipe is a phone gesture, and an app typically
// only offers it in the installed PWA, where the browser's own back-swipe isn't
// competing for the same edge. The host owns the open *state* and the
// resting-side choice; this hook only recognises the gesture and calls back.

// The two thresholds and the arithmetic over them live in `edgeSwipe.ts`, so
// a surface that has to recognise the same gesture from its own pointer stream
// can share them rather than copy them.

export type EdgeSwipeOpenOptions = {
  /** The edge to watch — the drawer's resting side. */
  side: MenuButtonSide;
  /** When false the listener is mounted but no-ops. */
  enabled: boolean;
  /** Called once when a completed edge swipe is recognised. */
  onOpen: () => void;
  /** How close to the border (px) a touch must start. Defaults to 30. */
  edgeZone?: number;
  /** Inward travel (px) required before opening. Defaults to 48. */
  openDistance?: number;
};

export function useEdgeSwipeOpen({
  side,
  enabled,
  onOpen,
  edgeZone = EDGE_ZONE_PX,
  openDistance = EDGE_OPEN_DISTANCE_PX,
}: EdgeSwipeOpenOptions): void {
  // Mirror the live inputs into a ref so the document listeners can be
  // attached once and read the latest values without re-subscribing on every
  // render (the drawer's side / enabled flag changes independently).
  const cfg = useRef({ side, enabled, onOpen, edgeZone, openDistance });
  cfg.current = { side, enabled, onOpen, edgeZone, openDistance };

  useEffect(() => {
    const start = { x: 0, y: 0, armed: false, fired: false };

    const onTouchStart = (e: TouchEvent) => {
      start.armed = false;
      start.fired = false;
      if (!cfg.current.enabled) return;
      if (e.touches.length !== 1) return;
      if (isModalOpen()) return;
      const touch = e.touches[0];
      if (!touch) return;
      const onWatchedEdge = inEdgeZone(
        touch.clientX,
        window.innerWidth,
        cfg.current.side,
        cfg.current.edgeZone,
      );
      if (!onWatchedEdge) return;
      start.x = touch.clientX;
      start.y = touch.clientY;
      start.armed = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!start.armed || start.fired) return;
      const touch = e.touches[0];
      if (!touch) return;
      const verdict = classifyEdgeDrag(
        touch.clientX - start.x,
        touch.clientY - start.y,
        cfg.current.side,
        cfg.current.openDistance,
      );
      // A mostly-vertical drag is a scroll, not an open — bail and let it be.
      if (verdict === "press") {
        start.armed = false;
        return;
      }
      if (verdict === "pending") return;
      start.fired = true;
      start.armed = false;
      if (e.cancelable) e.preventDefault();
      cfg.current.onOpen();
    };

    const onTouchEnd = () => {
      start.armed = false;
      start.fired = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    // Non-passive so the inward swipe can be claimed from any native gesture.
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
}
