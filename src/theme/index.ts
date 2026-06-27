// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public theme surface. The appearance *store* stays in the host app (it is
// woven together with app-specific settings — editor preferences, list
// layout, achievements); the framework owns the shared, drift-prone parts:
// the preset vocabulary, the palette data, the Custom-theme shape, the font
// loaders, and the projection engine. These are re-exported here and become
// available under the "@niclaslindstedt/oss-framework/theme" subpath.

export * from "./presets.ts";
export * from "./palettes.ts";
export * from "./preset-tokens.ts";
export * from "./custom-theme.ts";
export * from "./ui-style.ts";
export * from "./fonts.ts";
export * from "./engine.ts";
export * from "./ThemePreview.tsx";
export * from "./AppearancePicker.tsx";
export * from "./SettingsModal.tsx";
