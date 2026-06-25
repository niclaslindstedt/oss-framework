// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The theme engine: projects the chosen appearance onto `<html>` so the CSS
// variables in the host app's stylesheet (and every Tailwind utility that
// resolves through them) follow the picker. This is the single projection
// both source apps now share — they previously kept near-duplicate, drifted
// copies (`notes/src/theme/useTheme.ts`, `checklist/src/theme/useTheme.ts`).
//
// The projection runs as four independent effects so a font change doesn't
// rewrite the colour overrides (and vice versa):
//
//   1. `data-theme` on `<html>` from `theme`. CSS owns the preset palettes;
//      `custom` is a no-op at the CSS layer — effect (4) writes inline
//      overrides instead. While `system` is active the attribute stays
//      `system` and CSS follows `prefers-color-scheme`.
//   2. `--app-font-family` from the selected webfont stack; non-default
//      families are fetched on demand first (font-display: swap).
//   3. `--app-font-scale` multiplier the body font-size reads.
//   4. Custom-theme overrides: the colour vars + radius / density /
//      border-width / reduce-motion. Only written when `theme === "custom"`
//      so flipping back to a preset cleans every inline value out of the
//      style attribute.

import { useEffect } from "react";

import { COLOR_KEYS, COLOR_KEY_TO_CSS_VAR } from "./palettes.ts";
import { type CustomTheme } from "./custom-theme.ts";
import { loadFontFamily } from "./fonts.ts";
import {
  FONT_FAMILIES,
  type BorderWidthPreset,
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

function root(): HTMLElement {
  return document.documentElement;
}

// Per-element record of the custom-mode CSS vars + attributes we last wrote,
// so the next projection (or a switch away from `custom`) clears exactly
// those. This replaces the hand-maintained `removeProperty` lists the source
// apps carried — adding a colour slot or a shape var now touches only the
// writer below, and the cleanup follows automatically.
const written = new WeakMap<HTMLElement, { vars: string[]; attrs: string[] }>();

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
 * (4) Write the Custom-theme overrides — colour vars, radius / density /
 * border-width vars, and the `data-reduce-motion` attribute — clearing any
 * previously-written set first. Call only when the active theme is `custom`;
 * use `clearCustomTheme` otherwise.
 */
export function applyCustomTheme(
  custom: CustomTheme,
  el: HTMLElement = root(),
): void {
  clearCustomTheme(el);

  const vars: [name: string, value: string][] = [];
  for (const k of COLOR_KEYS) {
    vars.push([`--${COLOR_KEY_TO_CSS_VAR[k]}`, custom.colors[k]]);
  }
  const r = RADIUS_PX[custom.radius];
  vars.push(
    ["--radius-sm", r.sm],
    ["--radius-md", r.md],
    ["--radius-lg", r.lg],
  );
  const d = DENSITY[custom.density];
  vars.push(["--density-row-py", d.py], ["--density-row-px", d.px]);
  vars.push(["--border-width", BORDER_WIDTH_PX[custom.borderWidth]]);

  for (const [name, value] of vars) el.style.setProperty(name, value);
  el.setAttribute("data-reduce-motion", custom.reduceMotion ? "true" : "false");

  written.set(el, {
    vars: vars.map(([name]) => name),
    attrs: ["data-reduce-motion"],
  });
}

/** Remove every Custom-theme override this engine last wrote to `el`. */
export function clearCustomTheme(el: HTMLElement = root()): void {
  const prev = written.get(el);
  if (!prev) return;
  for (const name of prev.vars) el.style.removeProperty(name);
  for (const attr of prev.attrs) el.removeAttribute(attr);
  written.delete(el);
}

export type ThemeAppearance = {
  theme: ThemePreset;
  fontFamily: FontFamilyId;
  fontScale: number;
  customTheme: CustomTheme;
};

/**
 * Keep `<html>` in sync with the given appearance. Mount once near the root of
 * the app, passing the appearance to project — typically the live (preview-or-
 * persisted) values the host app's appearance/settings store exposes. The four
 * projecting effects run independently so each preference updates in isolation.
 */
export function useApplyTheme(appearance: ThemeAppearance): void {
  const { theme, fontFamily, fontScale, customTheme } = appearance;

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
    if (theme !== "custom") {
      clearCustomTheme();
      return;
    }
    applyCustomTheme(customTheme);
  }, [theme, customTheme]);
}

// The shape pixel maps are exported for a Custom editor that wants to preview
// the concrete value a preset resolves to (e.g. show "6px" next to "Medium").
export { RADIUS_PX, DENSITY, BORDER_WIDTH_PX };
