// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  coerceCustomTheme,
  COLOR_GROUPS,
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  COLOR_LABELS,
  customThemeSeed,
  DARK_THEMES,
  DEFAULT_CUSTOM_THEME,
  isFontFamily,
  isFontScale,
  isThemePreset,
  PRESET_PALETTES,
  themeFamily,
  THEMES,
} from "../src/theme/index.ts";

describe("preset vocabulary", () => {
  it("classifies presets into families", () => {
    expect(themeFamily("dracula")).toBe("dark");
    expect(themeFamily("gruvbox")).toBe("dark");
    expect(themeFamily("solarizedLight")).toBe("light");
    expect(themeFamily("system")).toBe("system");
    expect(themeFamily("custom")).toBe("custom");
  });

  it("guards stored values", () => {
    expect(isThemePreset("nord")).toBe(true);
    expect(isThemePreset("monokai")).toBe(false);
    expect(isThemePreset("teal")).toBe(false);
    expect(isFontFamily("serif")).toBe(true);
    expect(isFontFamily("wingdings")).toBe(false);
    expect(isFontScale(1.1)).toBe(true);
    expect(isFontScale(2)).toBe(false);
  });
});

describe("palette data integrity", () => {
  it("gives every non-system/custom preset a full slot set", () => {
    for (const preset of THEMES) {
      if (preset === "system" || preset === "custom") continue;
      const palette = PRESET_PALETTES[preset];
      for (const k of COLOR_KEYS) {
        expect(palette[k]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("maps and labels every colour key, and groups all of them once", () => {
    for (const k of COLOR_KEYS) {
      expect(COLOR_KEY_TO_CSS_VAR[k]).toBeTruthy();
      expect(COLOR_LABELS[k]).toBeTruthy();
    }
    const grouped = COLOR_GROUPS.flatMap((g) => g.keys);
    expect([...grouped].sort()).toEqual([...COLOR_KEYS].sort());
  });
});

describe("customThemeSeed", () => {
  it("seeds from the active preset's palette", () => {
    expect(customThemeSeed("dracula", false).colors).toEqual(
      PRESET_PALETTES.dracula,
    );
  });

  it("resolves system to the light or dark seed by preference", () => {
    expect(customThemeSeed("system", true).colors).toEqual(
      PRESET_PALETTES.githubLight,
    );
    expect(customThemeSeed("system", false).colors).toEqual(
      PRESET_PALETTES.githubDark,
    );
  });

  it("carries only the colour palette", () => {
    const seed = customThemeSeed(DARK_THEMES[0], false);
    expect(Object.keys(seed)).toEqual(["colors"]);
  });
});

describe("coerceCustomTheme", () => {
  it("returns the default for non-objects", () => {
    expect(coerceCustomTheme(null)).toEqual(DEFAULT_CUSTOM_THEME);
    expect(coerceCustomTheme("nope")).toEqual(DEFAULT_CUSTOM_THEME);
  });

  it("fills missing or malformed colour slots from the fallback", () => {
    const seed = customThemeSeed("githubLight", false);
    const coerced = coerceCustomTheme({ colors: { pageBg: "#123456" } }, seed);
    expect(coerced.colors.pageBg).toBe("#123456");
    expect(coerced.colors.surface).toBe(seed.colors.surface);
  });
});
