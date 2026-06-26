// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CSSProperties } from "react";

import { DEFAULT_GLYPH, GLYPH_PATHS } from "./catalogue.ts";

// Renders one catalogue glyph as an inline SVG. The path data lives in
// `catalogue.ts` as bare markup (so the same source can also build the favicon
// data URI); here we wrap it in a lucide-weight `<svg>` that paints with
// `currentColor`, so callers tint it through a text-colour class or an inline
// `color` style. An unknown / missing name falls back to the default glyph
// rather than rendering nothing.

type Props = {
  /** Glyph name from `GLYPH_PATHS`; falls back to the default when unknown. */
  name?: string;
  className?: string;
  /** Inline style — used to tint the glyph with an entity's accent colour. */
  style?: CSSProperties;
};

export function Glyph({ name, className, style }: Props) {
  const inner = (name && GLYPH_PATHS[name]) ?? GLYPH_PATHS[DEFAULT_GLYPH]!;
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
