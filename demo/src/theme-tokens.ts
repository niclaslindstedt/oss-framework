// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generates the per-preset CSS-variable blocks the framework theme engine
// expects an app to supply. The framework owns the palette *data*
// (`PRESET_PALETTES`) and the slot → CSS-var map; a host app turns that into
// the `:root[data-theme="…"]` rules its stylesheet would normally hand-write.
// The demo derives them at runtime instead so the preview's colours can never
// drift from the framework data they showcase — a small piece of dogfooding.
//
// The `custom` preset needs no block here: when it is active the engine writes
// every colour var inline on <html> itself.
import {
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_CUSTOM_THEME_COLORS_LIGHT,
  PRESET_PALETTES,
  type CustomThemeColors,
} from "@niclaslindstedt/oss-framework/theme";

function vars(colors: CustomThemeColors): string {
  return COLOR_KEYS.map(
    (k) => `  --${COLOR_KEY_TO_CSS_VAR[k]}: ${colors[k]};`,
  ).join("\n");
}

const presetBlocks = Object.entries(PRESET_PALETTES).map(
  ([preset, colors]) => `:root[data-theme="${preset}"] {\n${vars(colors)}\n}`,
);

// `system` follows the OS scheme: dark by default, light under the media query.
const systemBlock =
  `:root[data-theme="system"] {\n${vars(DEFAULT_CUSTOM_THEME_COLORS_DARK)}\n}\n` +
  `@media (prefers-color-scheme: light) {\n` +
  `  :root[data-theme="system"] {\n${vars(DEFAULT_CUSTOM_THEME_COLORS_LIGHT)}\n  }\n}`;

export const PRESET_TOKENS_CSS = [...presetBlocks, systemBlock].join("\n\n");

/**
 * Inject the generated preset blocks into <head> once. Call before the first
 * paint so the default theme's colours resolve immediately.
 */
export function installPresetTokens(): void {
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.ossFrameworkPresets = "";
  style.textContent = PRESET_TOKENS_CSS;
  document.head.appendChild(style);
}
