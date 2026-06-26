// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Glyph + accent-colour picker kit — the "give this thing an icon and a
// colour" surface. A dependency-free catalogue of inline lucide-weight glyphs,
// a renderer (`Glyph`), and the two presentational pickers (`GlyphPicker`,
// `ColorPalette`) an app composes into an appearance editor. The same glyph
// names feed `glyphDataUri`, which re-badges the favicon to the active
// entity's icon. The picked value (which glyph, which colour) lives in your
// app's store — this module owns only the catalogue, the rendering, and the
// picker chrome.

export {
  GLYPH_PATHS,
  DEFAULT_GLYPH,
  GLYPH_NAMES,
  isGlyphName,
  glyphSvg,
  glyphDataUri,
  type GlyphBadgeOptions,
} from "./catalogue.ts";
export { GLYPH_COLORS } from "./colors.ts";
export { Glyph } from "./Glyph.tsx";
export { GlyphPicker } from "./GlyphPicker.tsx";
export { ColorPalette } from "./ColorPalette.tsx";
