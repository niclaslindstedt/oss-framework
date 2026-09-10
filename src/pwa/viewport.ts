// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What the device says about the screen the app is drawn on — the numbers a
// mobile-layout bug is argued from.
//
// This exists because "the safe area is wrong" is the one class of bug that
// cannot be settled by looking. The two lengths a phone-shaped PWA depends on
// — the clear space above its top bar, and the gap under its last row — are
// decided by `env(safe-area-inset-*)`, and what those report differs between a
// browser tab and the same app installed to the home screen, between engines,
// and (on iOS) between what the value *says* and what the home indicator
// actually occupies. Without somewhere to read them, every such report is an
// argument about a number nobody has seen.
//
// So: an app puts these behind a developer screen and a bug report comes with
// evidence. The insets can only be read by asking the engine to resolve them
// somewhere — `env()` is a CSS *value*, not a property — so a throwaway
// element takes them as padding and `getComputedStyle` reads them back. That
// is the one form of `env()` every engine has always computed, which is why it
// is worth doing this way rather than reading a custom property that was
// authored from them.

import {
  INSET_PROBE_PADDING,
  pxOf,
  readSafeAreaInsets,
  resolveCssLength,
  type SafeAreaInsets,
} from "../components/safeArea.ts";

// The probe itself is a leaf (`components/safeArea.ts`) because floating
// panels read the same insets to decide where they may land. Re-exported here
// so this module stays the one place a developer screen imports from.
export {
  INSET_PROBE_PADDING,
  pxOf,
  readSafeAreaInsets,
  resolveCssLength,
  type SafeAreaInsets,
};

/** The screen geometry a developer screen prints. */
export interface ViewportReport {
  width: number;
  height: number;
  insets: SafeAreaInsets;
  /** `standalone` in an installed PWA, `browser` in a tab — see
   *  {@link displayModeOf}. */
  displayMode: string;
}

/** The insets as one line — top / right / bottom / left, the CSS order, with
 *  whole pixels. The fractional part of an inset is never the story. */
export function formatInsets(insets: SafeAreaInsets): string {
  return [insets.top, insets.right, insets.bottom, insets.left]
    .map((n) => Math.round(n))
    .join(" / ");
}

/** Which display mode the app is running in.
 *
 *  Only the modes that change a layout are named; anything else is reported
 *  verbatim, so an unexpected one is visible rather than mislabelled. The
 *  matcher is a parameter so this is testable without a browser. */
export function displayModeOf(
  matches: (query: string) => boolean,
  modes: readonly string[] = [
    "standalone",
    "fullscreen",
    "minimal-ui",
    "browser",
  ],
): string {
  for (const mode of modes) {
    if (matches(`(display-mode: ${mode})`)) return mode;
  }
  return "unknown";
}

/** Measure the live document. Returns `null` outside the browser.
 *
 *  An app that also wants the *resolved* value of its own chrome lengths adds
 *  them with {@link resolveCssLength} — those are the app's variables, so the
 *  framework cannot name them. */
export function readViewportReport(): ViewportReport | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    insets: readSafeAreaInsets(),
    displayMode: displayModeOf((q) => window.matchMedia(q).matches),
  };
}
