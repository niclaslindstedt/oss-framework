// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The user-authored Custom theme: its shape, its pristine default, the seed
// the picker opens with when the user switches into Custom, and a defensive
// coercion that turns arbitrary stored / synced JSON back into a valid
// `CustomTheme`. The runtime applies this when `theme === "custom"` (see
// `engine.ts`).

import {
  isBorderWidthPreset,
  isDensityPreset,
  isRadiusPreset,
  type BorderWidthPreset,
  type DensityPreset,
  type RadiusPreset,
  type ThemePreset,
} from "./presets.ts";
import {
  COLOR_KEYS,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_CUSTOM_THEME_COLORS_LIGHT,
  PRESET_PALETTES,
  type CustomThemeColors,
} from "./palettes.ts";

// User-authored theme applied when `theme === "custom"`. The picker re-seeds
// it from whichever theme is on screen each time the user switches into
// Custom (see `customThemeSeed`), so the editor opens as a copy of the
// current look and the first edit is a tweak.
export type CustomTheme = {
  colors: CustomThemeColors;
  radius: RadiusPreset;
  density: DensityPreset;
  borderWidth: BorderWidthPreset;
  // Globally short-circuits transition / animation durations via a
  // high-specificity rule keyed off `[data-reduce-motion="true"]`.
  reduceMotion: boolean;
};

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  colors: DEFAULT_CUSTOM_THEME_COLORS_DARK,
  radius: "md",
  density: "comfortable",
  borderWidth: "normal",
  reduceMotion: false,
};

// Snapshot of the theme currently on screen, used to seed the Custom controls
// when the user switches into Custom so the editor opens as a copy of the
// current look. Colours come from the active preset; `system` resolves via
// the caller-supplied `prefersLight`. Shape presets reset to the defaults.
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
  return {
    colors,
    radius: DEFAULT_CUSTOM_THEME.radius,
    density: DEFAULT_CUSTOM_THEME.density,
    borderWidth: DEFAULT_CUSTOM_THEME.borderWidth,
    reduceMotion: DEFAULT_CUSTOM_THEME.reduceMotion,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Coerce arbitrary stored JSON into a valid `CustomTheme`, filling each slot
// from `fallback` (default: `DEFAULT_CUSTOM_THEME`) when the stored value is
// missing or malformed. An app folds this into its own settings validator so
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
    radius: isRadiusPreset(obj.radius) ? obj.radius : fallback.radius,
    density: isDensityPreset(obj.density) ? obj.density : fallback.density,
    borderWidth: isBorderWidthPreset(obj.borderWidth)
      ? obj.borderWidth
      : fallback.borderWidth,
    reduceMotion:
      typeof obj.reduceMotion === "boolean"
        ? obj.reduceMotion
        : fallback.reduceMotion,
  };
}
