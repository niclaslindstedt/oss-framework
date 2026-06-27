---
type: Added
title: Importable stylesheet
---

The `theme` module now ships the framework's styling as an import instead of leaving it for every app to hand-write: `@import "@niclaslindstedt/oss-framework/styles.css"` pulls in the theme-token map, the button/elevation flavours, the drawer keyframes, the reduce-motion short-circuit, and every built-in preset's palette (baked in from `PRESET_PALETTES` at build time). `installPresetTokens()` / `PRESET_TOKENS_CSS` inject the preset blocks at runtime for apps building against source, and `@niclaslindstedt/oss-framework/theme/framework.css` exposes the static half on its own.
