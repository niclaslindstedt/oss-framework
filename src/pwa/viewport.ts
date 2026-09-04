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

/** The four safe-area insets, in CSS pixels. */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The screen geometry a developer screen prints. */
export interface ViewportReport {
  width: number;
  height: number;
  insets: SafeAreaInsets;
  /** `standalone` in an installed PWA, `browser` in a tab — see
   *  {@link displayModeOf}. */
  displayMode: string;
}

/** The padding shorthand a probe element carries so the engine resolves all
 *  four insets onto one element. Exported because an app measuring something
 *  of its own the same way should use the same probe. */
export const INSET_PROBE_PADDING =
  "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)";

/** `"12.5px"` → `12.5`; anything unparseable → `0`. A computed padding is
 *  always in px, but a browser that resolved nothing hands back `""`. */
export function pxOf(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
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

/** Resolve a CSS length expression against the live document and hand back the
 *  pixels it comes to.
 *
 *  The point is what it can be handed: `var(--my-gutter)`, whose authored value
 *  is a `calc()` over an `env()`. Reading the custom property gives back the
 *  expression, which is not the question — the *height a throwaway element set
 *  to it takes* is. Returns `0` outside the browser, or where the expression
 *  did not compute at all, which is itself the answer worth printing. */
export function resolveCssLength(expression: string): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:${expression}`;
  document.body.appendChild(probe);
  const px = pxOf(getComputedStyle(probe).height);
  probe.remove();
  return px;
}

/** Read the four safe-area insets off the live document. Zeroes outside the
 *  browser. */
export function readSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;box-sizing:content-box;visibility:hidden;pointer-events:none;padding:${INSET_PROBE_PADDING}`;
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: pxOf(style.paddingTop),
    right: pxOf(style.paddingRight),
    bottom: pxOf(style.paddingBottom),
    left: pxOf(style.paddingLeft),
  };
  probe.remove();
  return insets;
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
