---
type: Added
title: Glyph + accent-colour picker kit
---

`glyphs`: a new `@niclaslindstedt/oss-framework/glyphs` module for branding an entity (a list, a workspace, a category) with an icon and an accent colour. Ships a dependency-free catalogue of inline lucide-weight glyphs (`GLYPH_PATHS`, `GLYPH_NAMES`, `DEFAULT_GLYPH`, `isGlyphName`), a `Glyph` renderer, the two presentational pickers (`GlyphPicker`, `ColorPalette`) with a default `GLYPH_COLORS` palette, and `glyphSvg` / `glyphDataUri` favicon builders that re-badge the tab to the active entity's icon. The picked value lives in the app's store; the framework owns the catalogue, the renderer, and the picker chrome.
