// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCustomTheme,
  applyFontFamily,
  applyFontScale,
  applyThemePreset,
  clearCustomTheme,
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  DEFAULT_CUSTOM_THEME,
  FONT_FAMILIES,
  useApplyTheme,
  type CustomTheme,
  type ThemeAppearance,
} from "../src/theme/index.ts";

const html = () => document.documentElement;

function reset() {
  clearCustomTheme();
  html().removeAttribute("data-theme");
  html().removeAttribute("style");
}

afterEach(reset);

describe("theme projection primitives", () => {
  it("reflects the preset onto data-theme", () => {
    applyThemePreset("dracula");
    expect(html().getAttribute("data-theme")).toBe("dracula");
  });

  it("sets the font-family stack for a known family", () => {
    applyFontFamily("sans");
    const sans = FONT_FAMILIES.find((f) => f.id === "sans")!;
    expect(html().style.getPropertyValue("--app-font-family")).toBe(sans.stack);
  });

  it("ignores an unknown font family", () => {
    applyFontFamily("nope" as never);
    expect(html().style.getPropertyValue("--app-font-family")).toBe("");
  });

  it("sets the font scale as a string", () => {
    applyFontScale(1.25);
    expect(html().style.getPropertyValue("--app-font-scale")).toBe("1.25");
  });
});

describe("custom-theme overrides", () => {
  it("writes every colour slot, the shape vars, and the motion flag", () => {
    applyCustomTheme(DEFAULT_CUSTOM_THEME);
    for (const k of COLOR_KEYS) {
      expect(
        html().style.getPropertyValue(`--${COLOR_KEY_TO_CSS_VAR[k]}`),
      ).toBe(DEFAULT_CUSTOM_THEME.colors[k]);
    }
    expect(html().style.getPropertyValue("--radius-md")).toBe("6px");
    expect(html().style.getPropertyValue("--density-row-py")).toBe("0.375rem");
    expect(html().style.getPropertyValue("--border-width")).toBe("1px");
    expect(html().getAttribute("data-reduce-motion")).toBe("false");
  });

  it("clears exactly what it wrote", () => {
    applyCustomTheme(DEFAULT_CUSTOM_THEME);
    clearCustomTheme();
    expect(html().style.getPropertyValue("--page-bg")).toBe("");
    expect(html().style.getPropertyValue("--border-width")).toBe("");
    expect(html().hasAttribute("data-reduce-motion")).toBe(false);
  });

  it("re-applying does not leak stale vars from a previous custom theme", () => {
    applyCustomTheme(DEFAULT_CUSTOM_THEME);
    const tweaked: CustomTheme = {
      ...DEFAULT_CUSTOM_THEME,
      radius: "none",
      reduceMotion: true,
    };
    applyCustomTheme(tweaked);
    expect(html().style.getPropertyValue("--radius-md")).toBe("0px");
    expect(html().getAttribute("data-reduce-motion")).toBe("true");
  });
});

describe("useApplyTheme", () => {
  const base: ThemeAppearance = {
    theme: "dark",
    fontFamily: "mono",
    fontScale: 1,
    customTheme: DEFAULT_CUSTOM_THEME,
  };

  it("projects the appearance onto <html>", () => {
    renderHook(() => useApplyTheme(base));
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().style.getPropertyValue("--app-font-scale")).toBe("1");
  });

  it("writes custom overrides only while the custom preset is active", () => {
    const { rerender } = renderHook(
      (props: ThemeAppearance) => useApplyTheme(props),
      { initialProps: base },
    );

    rerender({ ...base, theme: "custom" });
    expect(html().style.getPropertyValue("--page-bg")).toBe(
      DEFAULT_CUSTOM_THEME.colors.pageBg,
    );

    rerender({ ...base, theme: "light" });
    expect(html().style.getPropertyValue("--page-bg")).toBe("");
  });
});
