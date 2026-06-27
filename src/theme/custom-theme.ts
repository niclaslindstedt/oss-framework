// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The user-authored Custom palette: its shape, its pristine default, the seed
// the picker opens with when the user switches into Custom, and a defensive
// coercion that turns arbitrary stored / synced JSON back into a valid
// `CustomTheme`. The runtime applies this when `theme === "custom"` (see
// `engine.ts`).
//
// `CustomTheme` is now *just* the colour palette. The shape / "flavour" knobs
// that used to ride along here (radius / density / borderWidth / reduceMotion)
// moved to `UiStyle` (`ui-style.ts`) so they apply to every theme, not only
// Custom. `coerceUiStyle` accepts a legacy `customTheme` object, so a document
// that stored those fields here still migrates forward.

import type { ThemePreset } from "./presets.ts";
import {
  COLOR_KEYS,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_CUSTOM_THEME_COLORS_LIGHT,
  PRESET_PALETTES,
  type CustomThemeColors,
} from "./palettes.ts";

// User-authored palette applied when `theme === "custom"`. The picker re-seeds
// it from whichever theme is on screen each time the user switches into
// Custom (see `customThemeSeed`), so the editor opens as a copy of the
// current look and the first edit is a tweak.
export type CustomTheme = {
  colors: CustomThemeColors;
};

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  colors: DEFAULT_CUSTOM_THEME_COLORS_DARK,
};

// Snapshot of the palette currently on screen, used to seed the Custom colour
// controls when the user switches into Custom so the editor opens as a copy of
// the current look. Colours come from the active preset; `system` resolves via
// the caller-supplied `prefersLight`.
export function customThemeSeed(
  theme: ThemePreset,
  prefersLight: boolean,
): CustomTheme {
  const colors =
    theme === "system"
      ? prefersLight
        ? DEFAULT_CUSTOM_THEME_COLORS_LIGHT
        : DEFAULT_CUSTOM_THEME_COLORS_DARK
      : theme === "custom"
        ? DEFAULT_CUSTOM_THEME_COLORS_DARK
        : PRESET_PALETTES[theme];
  return { colors };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Coerce arbitrary stored JSON into a valid `CustomTheme`, filling each colour
// slot from `fallback` (default: `DEFAULT_CUSTOM_THEME`) when the stored value
// is missing or malformed. An app folds this into its own settings validator so
// a partial or stale document never crashes the boot or paints a broken look.
export function coerceCustomTheme(
  raw: unknown,
  fallback: CustomTheme = DEFAULT_CUSTOM_THEME,
): CustomTheme {
  const obj = isRecord(raw) ? raw : {};
  const colors = isRecord(obj.colors) ? obj.colors : {};
  return {
    colors: COLOR_KEYS.reduce((acc, k) => {
      const v = colors[k];
      acc[k] = typeof v === "string" ? v : fallback.colors[k];
      return acc;
    }, {} as CustomThemeColors),
  };
}
