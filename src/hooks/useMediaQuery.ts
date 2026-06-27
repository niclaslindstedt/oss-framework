// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

// Subscribe a component to a CSS media query. Returns whether the query
// currently matches and re-renders when it flips. Reads the initial value
// synchronously so the first paint is already correct (no flash of the
// wrong layout), then tracks the `MediaQueryList`'s own `change` event —
// cheaper and more accurate than listening to `resize` and re-measuring.
//
// SSR-safe: with no `window` (or no `matchMedia`) it reports `false` and never
// subscribes, so the hook is inert on the server and during a non-DOM test.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Re-sync in case the query changed (or matched) between render and effect.
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// True on a "desktop"-style pointer: a device with a precise, hovering
// pointer (a mouse or trackpad) rather than a coarse touch screen. Gates
// affordances that only make sense with a real secondary click — chiefly
// right-click context menus; touch devices keep their swipe and tap
// affordances instead. A hybrid (a touch laptop) reports `hover: hover` and
// so opts into the desktop affordances while still supporting touch.
export function useDesktopPointer(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}
