// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CSSProperties } from "react";

// Pins a `position: fixed` full-screen overlay (a modal backdrop, a
// drawer) over the same band as the app shell. Vertically it tracks the
// *visual* viewport through two CSS variables the host app keeps live
// (`--app-top` / `--app-height`, e.g. mirrored from `window.visualViewport`
// by a viewport-height hook) so the overlay follows the iOS soft keyboard
// with the shell; horizontally it stays on the *layout* viewport
// (`left: 0; width: 100%`) so no layer can be pushed a sub-pixel past the
// viewport edge and turn into a sideways pan on iOS.
//
// Both variables are *optional*: the fallbacks reproduce a plain `inset: 0`
// (`top: 0`, full `100svh` height) before any script runs and when the app
// publishes no visual-viewport tracking — so the overlay is correct out of
// the box and merely gains keyboard-follow behaviour if the app opts in by
// setting the two vars.
export const APP_VIEWPORT_RECT: CSSProperties = {
  top: "var(--app-top, 0px)",
  left: 0,
  width: "100%",
  height: "var(--app-height, 100svh)",
};
