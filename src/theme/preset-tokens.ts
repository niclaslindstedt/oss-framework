// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The per-preset CSS-variable blocks the theme engine expects the page to carry
// — generated from `PRESET_PALETTES` so the colours can never drift from the
// framework's canonical palette data. This is the colour half of the styling
// contract; `framework.css` is the static structural half.
//
// Two ways to use it:
//   - Published apps import the prebuilt `styles.css` bundle, which already has
//     these blocks baked in at build time (see `scripts/build-styles.mjs`).
//   - Apps building against source (or that want the colours injected at
//     runtime) call `installPresetTokens()` once before the first paint, or
//     embed `PRESET_TOKENS_CSS` in their own stylesheet.
//
// The `custom` preset needs no block: when it is active the engine writes every
// colour var inline on <html> itself.

import {
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_CUSTOM_THEME_COLORS_LIGHT,
  PRESET_PALETTES,
  type CustomThemeColors,
} from "./palettes.ts";

function vars(colors: CustomThemeColors): string {
  return COLOR_KEYS.map(
    (k) => `  --${COLOR_KEY_TO_CSS_VAR[k]}: ${colors[k]};`,
  ).join("\n");
}

// `system` follows the OS scheme: dark by default, light under the media query.
const systemBlock =
  `:root[data-theme="system"] {\n${vars(DEFAULT_CUSTOM_THEME_COLORS_DARK)}\n}\n` +
  `@media (prefers-color-scheme: light) {\n` +
  `  :root[data-theme="system"] {\n${vars(DEFAULT_CUSTOM_THEME_COLORS_LIGHT)}\n  }\n}`;

/**
 * Each built-in theme's colour block on its own, keyed by the `data-theme`
 * value it paints — every preset plus `system`. One entry is everything a
 * single theme needs, which is what lets an app ship only the themes it
 * actually offers (the build emits these as `styles/theme/<id>.css` too).
 */
export const PRESET_TOKENS_BY_THEME: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(PRESET_PALETTES).map(([preset, colors]) => [
      preset,
      `:root[data-theme="${preset}"] {\n${vars(colors)}\n}`,
    ]),
  ),
  system: systemBlock,
};

/**
 * The generated `:root[data-theme="…"]` blocks for every built-in preset plus
 * the `system` (OS-following) block, as a single CSS string. Embed it in a
 * stylesheet, or use `installPresetTokens()` to inject it at runtime.
 */
export const PRESET_TOKENS_CSS = Object.values(PRESET_TOKENS_BY_THEME).join(
  "\n\n",
);

/**
 * Inject the generated preset blocks into `<head>` once. Call before the first
 * paint (e.g. in your entry module) so the default theme's colours resolve
 * immediately. Idempotent: a second call is a no-op. No-op outside the browser.
 *
 * Pass the themes you actually offer to inject only those — the same saving
 * the per-theme stylesheets give the build-time path. An unknown name is
 * skipped rather than throwing: a theme with no block simply doesn't paint.
 */
export function installPresetTokens(themes?: readonly string[]): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-oss-framework-presets]")) return;
  const css =
    themes === undefined
      ? PRESET_TOKENS_CSS
      : themes
          .map((t) => PRESET_TOKENS_BY_THEME[t])
          .filter((block) => block !== undefined)
          .join("\n\n");
  const style = document.createElement("style");
  style.dataset.ossFrameworkPresets = "";
  style.textContent = css;
  document.head.appendChild(style);
}
