// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  BACKDROP_BLUR_PRESETS,
  BACKDROP_DARKNESS_PRESETS,
  BUTTON_STYLE_PRESETS,
  CONTROL_STYLE_PRESETS,
  coerceUiStyle,
  DEFAULT_UI_STYLE,
  ELEVATION_PRESETS,
  isBackdropBlurPreset,
  isBackdropDarknessPreset,
  isButtonStylePreset,
  isControlStylePreset,
  isElevationPreset,
} from "../src/theme/index.ts";

describe("ui-style vocabulary", () => {
  it("guards the new flavour presets", () => {
    expect(isElevationPreset("floating")).toBe(true);
    expect(isElevationPreset("hover")).toBe(false);
    expect(isButtonStylePreset("outline")).toBe(true);
    expect(isButtonStylePreset("rounded")).toBe(false);
    expect(isControlStylePreset("circle")).toBe(true);
    expect(isControlStylePreset("solid")).toBe(false);
  });

  it("guards the backdrop presets", () => {
    expect(isBackdropDarknessPreset("dark")).toBe(true);
    expect(isBackdropDarknessPreset("strong")).toBe(false);
    expect(isBackdropBlurPreset("strong")).toBe(true);
    expect(isBackdropBlurPreset("dark")).toBe(false);
  });

  it("lists each flavour axis", () => {
    expect(ELEVATION_PRESETS).toContain("flat");
    expect(BUTTON_STYLE_PRESETS).toContain("ghost");
    expect(CONTROL_STYLE_PRESETS).toContain("square");
    expect(BACKDROP_DARKNESS_PRESETS).toEqual([
      "none",
      "subtle",
      "medium",
      "dark",
    ]);
    expect(BACKDROP_BLUR_PRESETS).toEqual([
      "none",
      "subtle",
      "medium",
      "strong",
    ]);
  });

  it("defaults the backdrop to the historical medium dim with no blur", () => {
    expect(DEFAULT_UI_STYLE.backdropDarkness).toBe("medium");
    expect(DEFAULT_UI_STYLE.backdropBlur).toBe("none");
  });
});

describe("coerceUiStyle", () => {
  it("returns the default for non-objects", () => {
    expect(coerceUiStyle(null)).toEqual(DEFAULT_UI_STYLE);
    expect(coerceUiStyle("nope")).toEqual(DEFAULT_UI_STYLE);
  });

  it("keeps valid stored axes", () => {
    const coerced = coerceUiStyle({
      radius: "lg",
      density: "compact",
      borderWidth: "bold",
      elevation: "floating",
      buttonStyle: "solid",
      controlStyle: "circle",
      backdropDarkness: "dark",
      backdropBlur: "strong",
      reduceMotion: true,
    });
    expect(coerced).toEqual({
      radius: "lg",
      density: "compact",
      borderWidth: "bold",
      elevation: "floating",
      buttonStyle: "solid",
      controlStyle: "circle",
      backdropDarkness: "dark",
      backdropBlur: "strong",
      reduceMotion: true,
    });
  });

  it("fills missing or malformed axes from the fallback", () => {
    const coerced = coerceUiStyle({
      elevation: "flat",
      buttonStyle: "bogus",
      backdropDarkness: "strong",
      reduceMotion: 1,
    });
    expect(coerced.elevation).toBe("flat");
    expect(coerced.buttonStyle).toBe(DEFAULT_UI_STYLE.buttonStyle);
    // `strong` is a blur level, not a darkness level — falls back to `medium`.
    expect(coerced.backdropDarkness).toBe(DEFAULT_UI_STYLE.backdropDarkness);
    expect(coerced.backdropBlur).toBe(DEFAULT_UI_STYLE.backdropBlur);
    expect(coerced.reduceMotion).toBe(DEFAULT_UI_STYLE.reduceMotion);
  });

  it("migrates a legacy customTheme object that carried the shape axes", () => {
    // Documents that stored radius/density/borderWidth/reduceMotion inside
    // `customTheme` migrate forward for free — the field names line up.
    const legacy = { radius: "none", density: "spacious", reduceMotion: true };
    const coerced = coerceUiStyle(legacy);
    expect(coerced.radius).toBe("none");
    expect(coerced.density).toBe("spacious");
    expect(coerced.reduceMotion).toBe(true);
    // Axes the legacy object lacked fall back to the defaults.
    expect(coerced.buttonStyle).toBe(DEFAULT_UI_STYLE.buttonStyle);
  });
});
