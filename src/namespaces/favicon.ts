// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Resolve the browser-tab favicon to the active namespace's glyph. When a
// namespace has picked an icon, that glyph (in its accent colour) stands in
// for your app's bundled mark as the tab favicon; without one, your supplied
// fallback href is used unchanged. Pairs with `applyFaviconHref`, which points
// the document's `<link rel="icon">` at the resolved href.
//
// The glyph → data-URI rendering is the `glyphs` module's `glyphDataUri`; this
// file only chooses *whether* to use it and supplies the fallback. The
// fallback path is yours to compute (it depends on your deploy's base path),
// so it is passed in rather than read from `import.meta.env` — keeping this
// module bundler-agnostic and CJS-safe.

import {
  glyphDataUri,
  isGlyphName,
  type GlyphBadgeOptions,
} from "../glyphs/index.ts";
import type { Namespace } from "./namespaces.ts";

export type NamespaceFaviconOptions = {
  /**
   * Colour used to tint a namespace that picked a glyph but no explicit
   * colour, so it still reads as "the app, re-badged". Default `"#64748b"`
   * (a neutral slate) — pass your app's accent for a branded fallback.
   */
  defaultColor?: string;
  /**
   * Badge geometry forwarded to `glyphDataUri` (size, corner radius,
   * background fill, padding). Defaults to a transparent badge — just the
   * stroked glyph, matching a typical bare tab favicon. Pass a `background`
   * to render an opaque badge that reads on a light tab bar.
   */
  badge?: GlyphBadgeOptions;
};

/**
 * The browser-tab favicon `href` for a namespace: its glyph as a data URI when
 * it has chosen a valid one, otherwise `fallbackHref`. A namespace with only a
 * colour (no glyph) keeps the fallback — the favicon is re-badged only when a
 * glyph is picked.
 */
export function namespaceFaviconHref(
  ns: Namespace | undefined,
  fallbackHref: string,
  options: NamespaceFaviconOptions = {},
): string {
  if (ns && isGlyphName(ns.glyph)) {
    const color = ns.color ?? options.defaultColor ?? "#64748b";
    return glyphDataUri(ns.glyph, color, options.badge);
  }
  return fallbackHref;
}

/**
 * Point the browser-tab favicon at `href`. Reuses the existing
 * `image/svg+xml` icon link in `<head>`, creating one only if absent. A no-op
 * outside the browser (SSR-safe).
 */
export function applyFaviconHref(href: string): void {
  if (typeof document === "undefined") return;
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="icon"][type="image/svg+xml"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = href;
}
