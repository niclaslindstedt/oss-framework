// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCustomTheme,
  applyFontFamily,
  applyFontScale,
  applyThemePreset,
  applyUiStyle,
  clearCustomTheme,
  clearUiStyle,
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_UI_STYLE,
  FONT_FAMILIES,
  useApplyTheme,
  type ThemeAppearance,
  type UiStyle,
} from "../src/theme/index.ts";

const html = () => document.documentElement;

function reset() {
  clearCustomTheme();
  clearUiStyle();
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

describe("custom-palette overrides", () => {
  it("writes every colour slot", () => {
    applyCustomTheme(DEFAULT_CUSTOM_THEME);
    for (const k of COLOR_KEYS) {
      expect(
        html().style.getPropertyValue(`--${COLOR_KEY_TO_CSS_VAR[k]}`),
      ).toBe(DEFAULT_CUSTOM_THEME.colors[k]);
    }
  });

  it("clears exactly the colour vars it wrote", () => {
    applyCustomTheme(DEFAULT_CUSTOM_THEME);
    clearCustomTheme();
    expect(html().style.getPropertyValue("--page-bg")).toBe("");
  });
});

describe("ui-style overrides", () => {
  it("writes the shape vars, the control radius, and the flavour attributes", () => {
    applyUiStyle(DEFAULT_UI_STYLE);
    expect(html().style.getPropertyValue("--radius-md")).toBe("6px");
    expect(html().style.getPropertyValue("--density-row-py")).toBe("0.375rem");
    expect(html().style.getPropertyValue("--border-width")).toBe("1px");
    expect(html().style.getPropertyValue("--control-radius")).toBe("4px");
    expect(html().getAttribute("data-button-style")).toBe("soft");
    expect(html().getAttribute("data-control-style")).toBe("rounded");
    expect(html().getAttribute("data-elevation")).toBe("raised");
    expect(html().getAttribute("data-reduce-motion")).toBe("false");
  });

  it("clears exactly what it wrote", () => {
    applyUiStyle(DEFAULT_UI_STYLE);
    clearUiStyle();
    expect(html().style.getPropertyValue("--radius-md")).toBe("");
    expect(html().style.getPropertyValue("--border-width")).toBe("");
    expect(html().style.getPropertyValue("--control-radius")).toBe("");
    expect(html().hasAttribute("data-button-style")).toBe(false);
    expect(html().hasAttribute("data-reduce-motion")).toBe(false);
  });

  it("re-applying does not leak stale values from a previous style", () => {
    applyUiStyle(DEFAULT_UI_STYLE);
    const tweaked: UiStyle = {
      ...DEFAULT_UI_STYLE,
      radius: "none",
      controlStyle: "circle",
      buttonStyle: "outline",
      reduceMotion: true,
    };
    applyUiStyle(tweaked);
    expect(html().style.getPropertyValue("--radius-md")).toBe("0px");
    expect(html().style.getPropertyValue("--control-radius")).toBe("9999px");
    expect(html().getAttribute("data-button-style")).toBe("outline");
    expect(html().getAttribute("data-reduce-motion")).toBe("true");
  });
});

describe("useApplyTheme", () => {
  const base: ThemeAppearance = {
    theme: "dark",
    fontFamily: "mono",
    fontScale: 1,
    ui: DEFAULT_UI_STYLE,
    customTheme: DEFAULT_CUSTOM_THEME,
  };

  it("projects the appearance onto <html>", () => {
    renderHook(() => useApplyTheme(base));
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().style.getPropertyValue("--app-font-scale")).toBe("1");
  });

  it("applies the UI style on every theme, not just custom", () => {
    renderHook(() => useApplyTheme(base));
    // `base` is the `dark` preset, yet the shape vars and flavour attributes
    // are still projected — they are independent of the colour palette.
    expect(html().style.getPropertyValue("--radius-md")).toBe("6px");
    expect(html().getAttribute("data-button-style")).toBe("soft");
    expect(html().getAttribute("data-elevation")).toBe("raised");
  });

  it("writes custom colour overrides only while the custom preset is active", () => {
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
