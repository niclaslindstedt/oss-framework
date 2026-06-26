// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Publish the pinned sidebar's footprint to the document as CSS variables so
// a viewport-`fixed` overlay mounted *outside* the app's flex layout can
// centre itself over the content area rather than the whole window. A toast
// rendered on every route is the case in point: it can't read the nav state,
// yet on a wide screen the pinned side menu eats 16rem on one edge and a
// window-centred toast lands visibly off-centre over the content.
//
// The variables are cleared on unmount, so standalone pages that never mount
// the sidebar fall back to a zero inset and centre on the full window.
//
// Read the published inset in CSS, e.g.:
//   left: var(--app-content-left, 0px);
//   right: var(--app-content-right, 0px);

import { useEffect } from "react";

import type { MenuButtonSide } from "./position.ts";

// Matches the `w-64` width of the pinned `<nav>` the `Sidebar` renders.
const SIDEBAR_WIDTH = "16rem";

export function useSidebarInset(pinned: boolean, side: MenuButtonSide): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--app-content-left",
      pinned && side === "left" ? SIDEBAR_WIDTH : "0px",
    );
    root.style.setProperty(
      "--app-content-right",
      pinned && side === "right" ? SIDEBAR_WIDTH : "0px",
    );
    return () => {
      root.style.removeProperty("--app-content-left");
      root.style.removeProperty("--app-content-right");
    };
  }, [pinned, side]);
}
