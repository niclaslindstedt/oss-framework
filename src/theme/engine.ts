// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The theme engine: projects the chosen appearance onto `<html>` so the CSS
// variables in the host app's stylesheet (and every Tailwind utility that
// resolves through them) follow the picker. This is the single projection
// both source apps now share — they previously kept near-duplicate, drifted
// copies (`notes/src/theme/useTheme.ts`, `checklist/src/theme/useTheme.ts`).
//
// The projection runs as five independent effects so a font change doesn't
// rewrite the colour overrides (and vice versa):
//
//   1. `data-theme` on `<html>` from `theme`. CSS owns the preset palettes;
//      `custom` is a no-op at the CSS layer — effect (5) writes inline
//      overrides instead. While `system` is active the attribute stays
//      `system` and CSS follows `prefers-color-scheme`.
//   2. `--app-font-family` from the selected webfont stack; non-default
//      families are fetched on demand first (font-display: swap).
//   3. `--app-font-scale` multiplier the body font-size reads.
//   4. UI-style overrides: the shape vars (radius / density / border-width),
//      the shadow scale (elevation), the control-radius var (control shape),
//      and the `data-button-style` / `data-control-style` / `data-elevation` /
//      `data-reduce-motion` attributes. Written for *every* theme — these are
//      global look knobs independent of the colour palette.
//   5. Custom-palette colour overrides: the 18 colour vars. Only written when
//      `theme === "custom"`, so flipping back to a preset cleans every inline
//      colour out of the style attribute.

import { useEffect } from "react";

import { COLOR_KEYS, COLOR_KEY_TO_CSS_VAR } from "./palettes.ts";
import { DEFAULT_CUSTOM_THEME, type CustomTheme } from "./custom-theme.ts";
import { DEFAULT_UI_STYLE, type UiStyle } from "./ui-style.ts";
import { loadFontFamily } from "./fonts.ts";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SCALE,
  DEFAULT_THEME,
  FONT_FAMILIES,
  type BorderWidthPreset,
  type ControlStylePreset,
  type DensityPreset,
  type FontFamilyId,
  type RadiusPreset,
  type ThemePreset,
} from "./presets.ts";

// `radius-sm/md/lg` triples per preset. "md" sits at the historical defaults;
// the others fan out symmetrically.
const RADIUS_PX: Record<RadiusPreset, { sm: string; md: string; lg: string }> =
  {
    none: { sm: "0px", md: "0px", lg: "0px" },
    sm: { sm: "2px", md: "4px", lg: "6px" },
    md: { sm: "4px", md: "6px", lg: "12px" },
    lg: { sm: "6px", md: "10px", lg: "20px" },
  };

// Row padding consumed by the `--density-row-*` vars.
const DENSITY: Record<DensityPreset, { py: string; px: string }> = {
  compact: { py: "0.25rem", px: "0.375rem" },
  comfortable: { py: "0.375rem", px: "0.5rem" },
  spacious: { py: "0.5rem", px: "0.75rem" },
};

const BORDER_WIDTH_PX: Record<BorderWidthPreset, string> = {
  thin: "0.5px",
  normal: "1px",
  bold: "2px",
};

// Corner radius of small toggles (checkbox / radio), written to
// `--control-radius`. `circle` rounds them fully; `square` is sharp.
const CONTROL_RADIUS: Record<ControlStylePreset, string> = {
  square: "0px",
  rounded: "4px",
  circle: "9999px",
};

function root(): HTMLElement {
  return document.documentElement;
}

// Per-element record of the inline vars + attributes a writer last set, so the
// next projection (or a switch away from `custom`) clears exactly those. Two
// tracks — one for the always-on UI style, one for the custom-only colours —
// since they are written and cleared independently. This replaces the
// hand-maintained `removeProperty` lists the source apps carried — adding a var
// or attribute touches only the writer below, and cleanup follows.
type Written = { vars: string[]; attrs: string[] };
const writtenColors = new WeakMap<HTMLElement, Written>();
const writtenUi = new WeakMap<HTMLElement, Written>();

function clearWritten(
  track: WeakMap<HTMLElement, Written>,
  el: HTMLElement,
): void {
  const prev = track.get(el);
  if (!prev) return;
  for (const name of prev.vars) el.style.removeProperty(name);
  for (const attr of prev.attrs) el.removeAttribute(attr);
  track.delete(el);
}

/** (1) Reflect the active preset onto `data-theme`. */
export function applyThemePreset(
  theme: ThemePreset,
  el: HTMLElement = root(),
): void {
  el.setAttribute("data-theme", theme);
}

/**
 * (2) Set the `--app-font-family` stack and lazily fetch a non-default
 * webfont. The stack is set immediately either way so the fallback paints at
 * once and the webfont swaps in when it lands.
 */
export function applyFontFamily(
  fontFamily: FontFamilyId,
  el: HTMLElement = root(),
): void {
  const family = FONT_FAMILIES.find((f) => f.id === fontFamily);
  if (!family) return;
  void loadFontFamily(fontFamily);
  el.style.setProperty("--app-font-family", family.stack);
}

/** (3) Set the `--app-font-scale` UI text-size multiplier. */
export function applyFontScale(
  fontScale: number,
  el: HTMLElement = root(),
): void {
  el.style.setProperty("--app-font-scale", String(fontScale));
}

/**
 * (4) Write the global UI-style overrides — the radius / density / border-width
 * vars, the control-radius var, and the `data-button-style` /
 * `data-control-style` / `data-elevation` / `data-reduce-motion` attributes —
 * clearing any previously-written set first. Applied for every theme; these are
 * look knobs independent of the colour palette. The shadow depth rides on the
 * `data-elevation` attribute (host CSS owns the shadow rules, like it owns the
 * `[data-theme]` palettes).
 */
export function applyUiStyle(ui: UiStyle, el: HTMLElement = root()): void {
  clearWritten(writtenUi, el);

  const vars: [name: string, value: string][] = [];
  const r = RADIUS_PX[ui.radius];
  vars.push(
    ["--radius-sm", r.sm],
    ["--radius-md", r.md],
    ["--radius-lg", r.lg],
  );
  const d = DENSITY[ui.density];
  vars.push(["--density-row-py", d.py], ["--density-row-px", d.px]);
  vars.push(["--border-width", BORDER_WIDTH_PX[ui.borderWidth]]);
  vars.push(["--control-radius", CONTROL_RADIUS[ui.controlStyle]]);

  for (const [name, value] of vars) el.style.setProperty(name, value);

  const attrs: [name: string, value: string][] = [
    ["data-button-style", ui.buttonStyle],
    ["data-control-style", ui.controlStyle],
    ["data-elevation", ui.elevation],
    ["data-reduce-motion", ui.reduceMotion ? "true" : "false"],
  ];
  for (const [name, value] of attrs) el.setAttribute(name, value);

  writtenUi.set(el, {
    vars: vars.map(([name]) => name),
    attrs: attrs.map(([name]) => name),
  });
}

/** Remove every UI-style override this engine last wrote to `el`. */
export function clearUiStyle(el: HTMLElement = root()): void {
  clearWritten(writtenUi, el);
}

/**
 * (5) Write the Custom-palette colour overrides — the 18 colour vars — clearing
 * any previously-written set first. Call only when the active theme is
 * `custom`; use `clearCustomTheme` otherwise.
 */
export function applyCustomTheme(
  custom: CustomTheme,
  el: HTMLElement = root(),
): void {
  clearWritten(writtenColors, el);

  const vars: [name: string, value: string][] = COLOR_KEYS.map((k) => [
    `--${COLOR_KEY_TO_CSS_VAR[k]}`,
    custom.colors[k],
  ]);
  for (const [name, value] of vars) el.style.setProperty(name, value);

  writtenColors.set(el, { vars: vars.map(([name]) => name), attrs: [] });
}

/** Remove every Custom-palette colour override this engine last wrote to `el`. */
export function clearCustomTheme(el: HTMLElement = root()): void {
  clearWritten(writtenColors, el);
}

export type ThemeAppearance = {
  theme: ThemePreset;
  fontFamily: FontFamilyId;
  fontScale: number;
  ui: UiStyle;
  customTheme: CustomTheme;
};

// The pristine appearance: each field at the module-level default the theme
// vocabulary declares. The starting point a host app's appearance store seeds
// from, what the framework's settings picker resets to, and the look the demo
// boots with.
export const DEFAULT_THEME_APPEARANCE: ThemeAppearance = {
  theme: DEFAULT_THEME,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontScale: DEFAULT_FONT_SCALE,
  ui: DEFAULT_UI_STYLE,
  customTheme: DEFAULT_CUSTOM_THEME,
};

/**
 * Keep `<html>` in sync with the given appearance. Mount once near the root of
 * the app, passing the appearance to project — typically the live (preview-or-
 * persisted) values the host app's appearance/settings store exposes. The five
 * projecting effects run independently so each preference updates in isolation.
 */
export function useApplyTheme(appearance: ThemeAppearance): void {
  const { theme, fontFamily, fontScale, ui, customTheme } = appearance;

  useEffect(() => {
    applyThemePreset(theme);
  }, [theme]);

  useEffect(() => {
    applyFontFamily(fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  useEffect(() => {
    applyUiStyle(ui);
  }, [ui]);

  useEffect(() => {
    if (theme !== "custom") {
      clearCustomTheme();
      return;
    }
    applyCustomTheme(customTheme);
  }, [theme, customTheme]);
}

// The shape pixel maps are exported for a Custom editor that wants to preview
// the concrete value a preset resolves to (e.g. show "6px" next to "Medium").
export { RADIUS_PX, DENSITY, BORDER_WIDTH_PX, CONTROL_RADIUS };
