// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";

// Keeps the document's `theme-color` meta on whatever the active theme
// actually resolves `--page-bg` to.
//
// `<meta name="theme-color">` is what tints the browser's own chrome around
// the page: Chrome's toolbar on Android, the task-switcher card, the title bar
// of an installed desktop PWA. An app's HTML shell can only ever ship a static
// light/dark pair there, and for a themed app that pair is a guess — the theme
// is one of a dozen presets, or "follow the device", or a custom palette the
// user mixed. Left alone, the chrome sits at the guess while the page sits at
// the real colour, and the seam between them is the first thing anyone notices
// on a phone.
//
// So once the engine has painted, the resolved value is read off `<html>` and
// written to *every* `theme-color` meta in the head. Every one, deliberately:
// a shell that ships a `prefers-color-scheme` pair has two of them, and which
// one the browser is honouring is not something the page can find out — so
// both carry the right colour and whichever wins is right.
//
// iOS's installed app is a separate story and needs nothing here: it paints
// its status-bar band from the page canvas, which the framework stylesheet
// gives `body`.

/** The value the metas carry when the page background can't be read — before
 *  the stylesheet has landed, or outside a browser. The framework's own light
 *  "paper" default. */
const FALLBACK_PAGE_BG = "#f6f8fa";

/** The resolved page background, as an authored colour string. */
function resolvedPageBg(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--page-bg")
    .trim();
  return value === "" ? FALLBACK_PAGE_BG : value;
}

/** Point every `theme-color` meta at the resolved page background.
 *
 *  Call after the theme engine has applied a change; a no-op outside the
 *  browser, and cheap enough to call on every appearance change. */
export function syncThemeColor(): void {
  if (typeof document === "undefined") return;
  const color = resolvedPageBg();
  const metas = document.head.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  metas.forEach((meta) => {
    meta.content = color;
  });
}

/** Re-sync when the OS light/dark preference flips.
 *
 *  Under a "follow the device" theme that flip changes the resolved background
 *  without any state of the app's changing, so nothing else would fire.
 *  Returns a teardown. */
export function watchSystemThemeColor(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => syncThemeColor();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Both of the above, as one hook: sync now, and again whenever the device's
 *  light/dark preference flips.
 *
 *  Mount it beside `useApplyTheme` and pass whatever changes when the
 *  appearance does — the theme id will do — so the meta is rewritten after the
 *  engine has repainted `<html>`. It is a separate hook rather than part of
 *  `useApplyTheme` because writing to an app's `<head>` is the app's call: a
 *  host that stamps its own chrome colour, or renders inside another page,
 *  should not have it taken over.
 */
export function useThemeColorMeta(...deps: unknown[]): void {
  useEffect(() => {
    syncThemeColor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => watchSystemThemeColor(), []);
}
