// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The lengths the *device* keeps for itself, and the way to read them.
//
// `env(safe-area-inset-*)` is a CSS value, not a property, so nothing can ask
// for it directly: the only way every engine has always computed is to hand a
// throwaway element the expression and read back what it took. That probe is
// here — a leaf with no React and no module of its own — because two very
// different callers need the same numbers: a developer screen printing them as
// evidence (`pwa/viewport.ts`), and every floating panel deciding where it is
// allowed to land (`useFloatingPosition.ts`).

/** The four safe-area insets, in CSS pixels. */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
