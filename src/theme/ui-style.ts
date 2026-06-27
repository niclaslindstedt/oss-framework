// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The global UI style: the shape / "flavour" knobs that apply to *every* theme,
// preset or custom — corner radius, row density, border weight, shadow depth,
// button treatment, control shape, and reduced motion. Unlike the colour
// palette (which the `theme` preset picks), these shape the chrome itself, so a
// user can run any palette with sharp corners, bold borders, pill checkboxes,
// flat or floating surfaces, and so on.
//
// This is the home for what used to live cramped inside `CustomTheme` and only
// took effect in Custom mode (`radius` / `density` / `borderWidth` /
// `reduceMotion`). Pulling them out here — and adding `elevation`,
// `buttonStyle`, and `controlStyle` alongside — lets the projection apply them
// across all themes. The runtime maps each value to its CSS var / data-attribute
// in `engine.ts`; this module fixes the shape, the default, the seed, and a
// defensive coercion for stored / synced JSON.

import {
  isBorderWidthPreset,
  isButtonStylePreset,
  isControlStylePreset,
  isDensityPreset,
  isElevationPreset,
  isRadiusPreset,
  type BorderWidthPreset,
  type ButtonStylePreset,
  type ControlStylePreset,
  type DensityPreset,
  type ElevationPreset,
  type RadiusPreset,
} from "./presets.ts";

// The chosen value per global look axis. Applied by the projection on every
// theme; see `engine.ts` for the var / attribute each field maps to.
export type UiStyle = {
  radius: RadiusPreset;
  density: DensityPreset;
  borderWidth: BorderWidthPreset;
  elevation: ElevationPreset;
  buttonStyle: ButtonStylePreset;
  controlStyle: ControlStylePreset;
  // Globally short-circuits transition / animation durations via a
  // high-specificity rule keyed off `[data-reduce-motion="true"]`.
  reduceMotion: boolean;
};

// The pristine UI style: the historical defaults each axis sat at when these
// knobs lived in `CustomTheme`, plus `raised` / `soft` / `rounded` for the
// three new axes (the look the chrome already shipped).
export const DEFAULT_UI_STYLE: UiStyle = {
  radius: "md",
  density: "comfortable",
  borderWidth: "normal",
  elevation: "raised",
  buttonStyle: "soft",
  controlStyle: "rounded",
  reduceMotion: false,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Coerce arbitrary stored JSON into a valid `UiStyle`, filling each axis from
// `fallback` (default: `DEFAULT_UI_STYLE`) when the stored value is missing or
// malformed. An app folds this into its own settings validator so a partial or
// stale document never crashes the boot or paints a broken look. Legacy
// documents that stored these axes inside `customTheme` can pass that object
// here — the field names line up, so the shape knobs migrate forward for free.
export function coerceUiStyle(
  raw: unknown,
  fallback: UiStyle = DEFAULT_UI_STYLE,
): UiStyle {
  const obj = isRecord(raw) ? raw : {};
  return {
    radius: isRadiusPreset(obj.radius) ? obj.radius : fallback.radius,
    density: isDensityPreset(obj.density) ? obj.density : fallback.density,
    borderWidth: isBorderWidthPreset(obj.borderWidth)
      ? obj.borderWidth
      : fallback.borderWidth,
    elevation: isElevationPreset(obj.elevation)
      ? obj.elevation
      : fallback.elevation,
    buttonStyle: isButtonStylePreset(obj.buttonStyle)
      ? obj.buttonStyle
      : fallback.buttonStyle,
    controlStyle: isControlStylePreset(obj.controlStyle)
      ? obj.controlStyle
      : fallback.controlStyle,
    reduceMotion:
      typeof obj.reduceMotion === "boolean"
        ? obj.reduceMotion
        : fallback.reduceMotion,
  };
}
