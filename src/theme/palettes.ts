// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Colour data: the per-slot custom-colour shape, the ordered slot list, the
// slot → CSS-variable map, the display metadata an Appearance editor groups
// by, and the per-preset palettes the Custom editor seeds from.
//
// This is the framework's canonical colour vocabulary — eighteen slots. The
// source apps had drifted (notes carried eleven, checklist eighteen); the
// framework heals that by owning one palette table both apps render through.
// CSS owns the actual rules for the non-`custom` presets (each app's
// `palettes.css`); these values mirror those rules so the Custom editor's
// seed swatches match what the CSS paints.

// Per-slot custom colours — one field per CSS variable the chrome reads. The
// projection maps each key to its `--<slug>` CSS var on `<html>` when the
// active theme is `custom` (see `engine.ts`).
export type CustomThemeColors = {
  pageBg: string;
  surface: string;
  surface2: string;
  surface3: string;
  fg: string;
  fgBright: string;
  muted: string;
  line: string;
  accent: string;
  meta: string;
  link: string;
  path: string;
  flag: string;
  pipe: string;
  danger: string;
  success: string;
  positive: string;
  negative: string;
};

// Ordered list of colour keys. A validator walks every slot; a picker uses it
// via `COLOR_GROUPS` for display order within a group.
export const COLOR_KEYS: readonly (keyof CustomThemeColors)[] = [
  "pageBg",
  "surface",
  "surface2",
  "surface3",
  "fg",
  "fgBright",
  "muted",
  "line",
  "accent",
  "meta",
  "link",
  "path",
  "flag",
  "pipe",
  "danger",
  "success",
  "positive",
  "negative",
];

// Maps each colour key to the CSS-variable slug (the part after `--`) the
// runtime writes when Custom is active.
export const COLOR_KEY_TO_CSS_VAR: Record<keyof CustomThemeColors, string> = {
  pageBg: "page-bg",
  surface: "surface",
  surface2: "surface-2",
  surface3: "surface-3",
  fg: "fg",
  fgBright: "fg-bright",
  muted: "muted",
  line: "line",
  accent: "accent",
  meta: "meta",
  link: "link",
  path: "path",
  flag: "flag",
  pipe: "pipe",
  danger: "danger",
  success: "success",
  positive: "positive",
  negative: "negative",
};

// Human-readable labels for the colour slots, keyed by colour key.
export const COLOR_LABELS: Record<keyof CustomThemeColors, string> = {
  pageBg: "Page background",
  surface: "Surface",
  surface2: "Surface (raised)",
  surface3: "Surface (sunken)",
  fg: "Text",
  fgBright: "Bright text",
  muted: "Muted text",
  line: "Lines",
  accent: "Accent",
  meta: "Meta",
  link: "Link",
  path: "Path",
  flag: "Flag",
  pipe: "Pipe",
  danger: "Danger",
  success: "Success",
  positive: "Positive",
  negative: "Negative",
};

// How a Custom panel groups the colour controls so the section stays
// scannable. `label` heads each group.
export const COLOR_GROUPS: readonly {
  id: "backgrounds" | "text" | "lines" | "accents" | "status";
  label: string;
  keys: readonly (keyof CustomThemeColors)[];
}[] = [
  {
    id: "backgrounds",
    label: "Backgrounds",
    keys: ["pageBg", "surface", "surface2", "surface3"],
  },
  { id: "text", label: "Text", keys: ["fg", "fgBright", "muted"] },
  { id: "lines", label: "Lines", keys: ["line"] },
  {
    id: "accents",
    label: "Accents",
    keys: ["accent", "meta", "link", "path", "flag", "pipe"],
  },
  {
    id: "status",
    label: "Status",
    keys: ["danger", "success", "positive", "negative"],
  },
];

// Per-preset palette lookup — the single source of truth for the Custom
// editor's seed colours and a picker's variant-row swatches. Each entry is
// checked against `CustomThemeColors`, so adding a preset is one entry here
// (plus registering its id in `ThemePreset` / `THEMES` and the matching
// family array in `presets.ts`). Colours mirror the rules in each app's
// `palettes.css`.
export const PRESET_PALETTES: Record<
  Exclude<import("./presets.ts").ThemePreset, "system" | "custom">,
  CustomThemeColors
> = {
  // One Dark.
  dark: {
    pageBg: "#1d2027",
    surface: "#282c34",
    surface2: "#2c313a",
    surface3: "#21252b",
    fg: "#abb2bf",
    fgBright: "#e6e6e6",
    muted: "#9097a8",
    line: "#3e4451",
    accent: "#98c379",
    meta: "#e5c07b",
    link: "#61afef",
    path: "#56b6c2",
    flag: "#d19a66",
    pipe: "#c678dd",
    danger: "#e06c75",
    success: "#98c379",
    positive: "#b5e3a0",
    negative: "#f0b4ba",
  },
  // One Light.
  light: {
    pageBg: "#eef0f2",
    surface: "#f8f9fa",
    surface2: "#f1f3f5",
    surface3: "#e4e7eb",
    fg: "#2f323a",
    fgBright: "#15171c",
    muted: "#6a6f7c",
    line: "#ccd0d6",
    accent: "#3f8c3e",
    meta: "#9c6a00",
    link: "#2960c2",
    path: "#0a6e92",
    flag: "#ad4c00",
    pipe: "#872187",
    danger: "#c9434c",
    success: "#3f8c3e",
    positive: "#5fa057",
    negative: "#d77a82",
  },
  dracula: {
    pageBg: "#21222c",
    surface: "#282a36",
    surface2: "#343746",
    surface3: "#191a21",
    fg: "#f8f8f2",
    fgBright: "#ffffff",
    muted: "#8b93c2",
    line: "#44475a",
    accent: "#50fa7b",
    meta: "#f1fa8c",
    link: "#8be9fd",
    path: "#bd93f9",
    flag: "#ffb86c",
    pipe: "#ff79c6",
    danger: "#ff5555",
    success: "#50fa7b",
    positive: "#a8ffb8",
    negative: "#ffb3c5",
  },
  monokai: {
    pageBg: "#1e1f1c",
    surface: "#272822",
    surface2: "#3e3d32",
    surface3: "#1b1c18",
    fg: "#f8f8f2",
    fgBright: "#ffffff",
    muted: "#9c9882",
    line: "#49483e",
    accent: "#a6e22e",
    meta: "#e6db74",
    link: "#66d9ef",
    path: "#66d9ef",
    flag: "#fd971f",
    pipe: "#ae81ff",
    danger: "#f92672",
    success: "#a6e22e",
    positive: "#b6e354",
    negative: "#f49ab1",
  },
  githubDark: {
    pageBg: "#010409",
    surface: "#0d1117",
    surface2: "#161b22",
    surface3: "#010409",
    fg: "#c9d1d9",
    fgBright: "#f0f6fc",
    muted: "#8b949e",
    line: "#30363d",
    accent: "#7ee787",
    meta: "#d29922",
    link: "#79c0ff",
    path: "#56d4dd",
    flag: "#ffa657",
    pipe: "#d2a8ff",
    danger: "#ff7b72",
    success: "#7ee787",
    positive: "#aff5b4",
    negative: "#ffb8b3",
  },
  githubLight: {
    pageBg: "#f6f8fa",
    surface: "#ffffff",
    surface2: "#eaeef2",
    surface3: "#d0d7de",
    fg: "#1f2328",
    fgBright: "#0d1117",
    muted: "#6e7781",
    line: "#d0d7de",
    accent: "#1a7f37",
    meta: "#9a6700",
    link: "#0969da",
    path: "#0550ae",
    flag: "#bc4c00",
    pipe: "#8250df",
    danger: "#cf222e",
    success: "#1a7f37",
    positive: "#4ac26b",
    negative: "#e5717f",
  },
  solarizedLight: {
    pageBg: "#eee8d5",
    surface: "#fdf6e3",
    surface2: "#f5efdc",
    surface3: "#e3ddc9",
    fg: "#586e75",
    fgBright: "#073642",
    muted: "#657b83",
    line: "#d6cfb8",
    accent: "#859900",
    meta: "#b58900",
    link: "#268bd2",
    path: "#2aa198",
    flag: "#cb4b16",
    pipe: "#6c71c4",
    danger: "#dc322f",
    success: "#859900",
    positive: "#719e00",
    negative: "#d33682",
  },
  quietLight: {
    pageBg: "#f5f5f5",
    surface: "#ffffff",
    surface2: "#ebebeb",
    surface3: "#e0e0e0",
    fg: "#333333",
    fgBright: "#1a1a1a",
    muted: "#767676",
    line: "#d4d4d4",
    accent: "#4f894c",
    meta: "#ae6e29",
    link: "#4b83cd",
    path: "#1d8696",
    flag: "#aa6624",
    pipe: "#7e54a5",
    danger: "#b73525",
    success: "#4f894c",
    positive: "#6c9d56",
    negative: "#cf6e6a",
  },
  excel: {
    pageBg: "#e6e6e6",
    surface: "#ffffff",
    surface2: "#f3f2f1",
    surface3: "#e1dfdd",
    fg: "#252423",
    fgBright: "#171717",
    muted: "#605e5c",
    line: "#d4d4d4",
    accent: "#217346",
    meta: "#a6730a",
    link: "#0563c1",
    path: "#0e7490",
    flag: "#c55a11",
    pipe: "#7030a0",
    danger: "#c00000",
    success: "#217346",
    positive: "#3f7d3a",
    negative: "#c84031",
  },
};

// One Dark is the Custom theme's pristine default and a validator's fallback
// for a missing colour; One Light is the light-mode seed. Both are referenced
// by name elsewhere, so they keep a named alias derived from the table above.
export const DEFAULT_CUSTOM_THEME_COLORS_DARK = PRESET_PALETTES.dark;
export const DEFAULT_CUSTOM_THEME_COLORS_LIGHT = PRESET_PALETTES.light;
