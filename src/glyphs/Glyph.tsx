// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CSSProperties, ReactNode } from "react";

import { DEFAULT_GLYPH, GLYPH_PATHS } from "./catalogue.ts";

// Renders one catalogue glyph as an inline SVG. The path data lives in
// `catalogue.ts` as bare markup (so the same source can also build the favicon
// data URI); here we wrap it in a lucide-weight `<svg>` that paints with
// `currentColor`, so callers tint it through a text-colour class or an inline
// `color` style. An unknown / missing name falls back to the default glyph
// rather than rendering nothing — or to a caller-supplied `fallback` node, so
// an app whose glyph-less default isn't a catalogue glyph can draw its own.
// `paths` swaps the whole table, letting an app render a domain-specific
// catalogue through the same component.

type Props = {
  /** Glyph name from the active path table; falls back when unknown. */
  name?: string;
  className?: string;
  /** Inline style — used to tint the glyph with an entity's accent colour. */
  style?: CSSProperties;
  /**
   * The path table to draw from — bare inner-SVG markup keyed by glyph name.
   * Defaults to the built-in `GLYPH_PATHS`; pass an app's own catalogue to
   * render a custom glyph vocabulary through the same lucide-weight shell.
   */
  paths?: Record<string, string>;
  /**
   * Rendered when `name` resolves to nothing in the active table. Defaults to
   * drawing the built-in `DEFAULT_GLYPH`; pass a node when the fallback mark
   * isn't a catalogue glyph. The node is rendered as-is — size and tint it
   * yourself (e.g. via the same `className` you'd hand this component).
   */
  fallback?: ReactNode;
};

export function Glyph({
  name,
  className,
  style,
  paths = GLYPH_PATHS,
  fallback,
}: Props) {
  const resolved = name ? paths[name] : undefined;
  if (!resolved && fallback !== undefined) return <>{fallback}</>;
  const inner = resolved ?? GLYPH_PATHS[DEFAULT_GLYPH]!;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
