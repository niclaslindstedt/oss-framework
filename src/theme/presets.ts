// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Theme vocabulary: the preset ids the engine can apply, the bundled font
// stacks, the UI text-size steps, and the radius / density / border-width
// shape presets. This is the single source of truth for which preset ids,
// font families, and shape presets are valid — a settings validator, an
// Appearance picker, and the projection engine all read it from here.
//
// CSS owns the actual palette rules for the non-`custom` presets (each app's
// `palettes.css`); the colour *data* those rules mirror lives in
// `palettes.ts`, and the `custom` preset's runtime overrides are produced by
// the projection in `engine.ts`.

// Theme preset — a curated, deliberately *distinct* roster (each palette is a
// different temperature / mood, not one editor scheme recoloured). The default
// `githubDark` keeps the neutral monospaced "dev" feel; the rest fan out:
// `tokyoNight` deep indigo, `nord` cool arctic blue, `dracula` vivid purple,
// `catppuccin` soft pastel lavender, `rosePine` muted rose/plum, `gruvbox` warm
// retro amber, `solarizedDark` teal/scholarly. Lights: `githubLight` crisp
// high-contrast, `catppuccinLatte` cool pastel, `rosePineDawn` warm rosy,
// `solarizedLight` warm paper. `system` follows `prefers-color-scheme`;
// `custom` applies the user's colour overrides. The runtime writes the active
// value to `data-theme` on `<html>`.
export type ThemePreset =
  | "githubDark"
  | "tokyoNight"
  | "nord"
  | "dracula"
  | "catppuccin"
  | "rosePine"
  | "gruvbox"
  | "solarizedDark"
  | "githubLight"
  | "catppuccinLatte"
  | "rosePineDawn"
  | "solarizedLight"
  | "system"
  | "custom";

// Allowed theme presets, in the order an Appearance picker shows them.
// Source of truth for a settings validator and the picker UI. Dark variants
// first, then light variants, then the two non-coloured presets.
export const THEMES = [
  "githubDark",
  "tokyoNight",
  "nord",
  "dracula",
  "catppuccin",
  "rosePine",
  "gruvbox",
  "solarizedDark",
  "githubLight",
  "catppuccinLatte",
  "rosePineDawn",
  "solarizedLight",
  "system",
  "custom",
] as const;

// GitHub Dark — the neutral "dev" look — is the default until the user picks
// otherwise.
export const DEFAULT_THEME: ThemePreset = "githubDark";

// Theme presets in the Dark family, in variant-row order (the default first).
export const DARK_THEMES = [
  "githubDark",
  "tokyoNight",
  "nord",
  "dracula",
  "catppuccin",
  "rosePine",
  "gruvbox",
  "solarizedDark",
] as const;

// Theme presets in the Light family — the crisp neutral light first, then the
// two pastel lights, then the warm paper light.
export const LIGHT_THEMES = [
  "githubLight",
  "catppuccinLatte",
  "rosePineDawn",
  "solarizedLight",
] as const;

// Broad colour-scheme family a preset belongs to. A picker's mode row selects
// the family (Dark / Light / System / Custom); a variant row appears
// underneath for the Dark / Light families.
export type ThemeFamily = "dark" | "light" | "system" | "custom";

// Resolve a preset to its broad family. Dark / Light variants fold into their
// bucket; `system` and `custom` are their own families.
export function themeFamily(preset: ThemePreset): ThemeFamily {
  if ((DARK_THEMES as readonly string[]).includes(preset)) return "dark";
  if ((LIGHT_THEMES as readonly string[]).includes(preset)) return "light";
  return preset as "system" | "custom";
}

// Default preset for each family — what the mode row jumps to when the user
// picks a family they weren't already in.
export const FAMILY_DEFAULT_THEME: Record<ThemeFamily, ThemePreset> = {
  dark: "githubDark",
  light: "githubLight",
  system: "system",
  custom: "custom",
};

// Display labels for the theme presets and families, used by the picker. An
// app that localizes its UI can ignore these and map ids through its own i18n
// catalogue instead.
export const THEME_LABELS: Record<ThemePreset, string> = {
  githubDark: "GitHub Dark",
  tokyoNight: "Tokyo Night",
  nord: "Nord",
  dracula: "Dracula",
  catppuccin: "Catppuccin Mocha",
  rosePine: "Rosé Pine",
  gruvbox: "Gruvbox",
  solarizedDark: "Solarized Dark",
  githubLight: "GitHub Light",
  catppuccinLatte: "Catppuccin Latte",
  rosePineDawn: "Rosé Pine Dawn",
  solarizedLight: "Solarized Light",
  system: "System",
  custom: "Custom",
};

export const FAMILY_LABELS: Record<ThemeFamily, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
  custom: "Custom",
};

export function isThemePreset(v: unknown): v is ThemePreset {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

// Bundled webfont families the body reads through `--app-font-family`.
// Monospace is the default — the UI is deliberately reminiscent of a
// plain-text editor. The other three load on demand (see `fonts.ts`).
// `stack` is the full CSS `font-family` value.
export type FontFamilyId = "mono" | "sans" | "serif" | "dyslexic";

export const FONT_FAMILIES: readonly {
  id: FontFamilyId;
  label: string;
  stack: string;
}[] = [
  {
    id: "mono",
    label: "Monospace",
    stack:
      '"JetBrains Mono", "Fira Code", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    id: "sans",
    label: "Sans-serif",
    stack:
      '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    stack: '"Source Serif 4", ui-serif, Georgia, "Times New Roman", serif',
  },
  {
    id: "dyslexic",
    label: "OpenDyslexic",
    stack:
      '"OpenDyslexic", "Comic Sans MS", ui-sans-serif, system-ui, sans-serif',
  },
];

export const DEFAULT_FONT_FAMILY: FontFamilyId = "mono";

const FONT_FAMILY_IDS = new Set<string>(FONT_FAMILIES.map((f) => f.id));

export function isFontFamily(v: unknown): v is FontFamilyId {
  return typeof v === "string" && FONT_FAMILY_IDS.has(v);
}

// Discrete UI text-size multipliers offered by the Appearance section. A body
// `font-size` that multiplies by `--app-font-scale` lets every rem dimension
// downstream pick up the chosen step. An app that localizes its labels can
// build its own `{ scale, label }` list off `FONT_SCALES`.
export const FONT_SCALE_PRESETS: readonly { scale: number; label: string }[] = [
  { scale: 0.9, label: "90%" },
  { scale: 1, label: "100%" },
  { scale: 1.1, label: "110%" },
  { scale: 1.25, label: "125%" },
];

export const FONT_SCALES: readonly number[] = FONT_SCALE_PRESETS.map(
  (p) => p.scale,
);
export const MIN_FONT_SCALE = 0.9;
export const MAX_FONT_SCALE = 1.25;
export const DEFAULT_FONT_SCALE = 1;

const FONT_SCALE_SET = new Set<number>(FONT_SCALES);

export function isFontScale(v: unknown): v is number {
  return typeof v === "number" && FONT_SCALE_SET.has(v);
}

// Shape & "flavour" presets the UI-style controls offer. These are global
// look knobs that apply to *every* theme (preset or custom) — they shape the
// chrome (corner rounding, row density, border weight, shadow depth, button
// treatment, control shape, motion) independently of the colour palette, so
// "One Dark with sharp corners and pill buttons" is a thing you can pick. The
// numeric pixel/rem/shadow mapping for each one lives in the projection engine
// (`engine.ts`); this module fixes only the vocabulary. The `UiStyle` bundle
// that carries a chosen value per axis lives in `ui-style.ts`.
export type RadiusPreset = "none" | "sm" | "md" | "lg";
export type DensityPreset = "compact" | "comfortable" | "spacious";
export type BorderWidthPreset = "thin" | "normal" | "bold";
// Shadow depth of raised chrome — modals, popovers, cards, raised buttons.
// `flat` drops every shadow (the editor-like, border-only look); `floating`
// lifts them well off the page.
export type ElevationPreset = "flat" | "raised" | "floating";
// How buttons are filled. `soft` is the tinted default; `solid` paints a full
// accent fill; `outline` is a transparent, bordered button; `ghost` is text
// only until hovered. Projected as `data-button-style` for CSS to key off.
export type ButtonStylePreset = "soft" | "solid" | "outline" | "ghost";
// The shape of small toggles — checkboxes, radios. `square` is sharp,
// `rounded` softens the corners, `circle` makes them fully round. Projected
// both as a `--control-radius` var and as `data-control-style`.
export type ControlStylePreset = "square" | "rounded" | "circle";

export const RADIUS_PRESETS: readonly RadiusPreset[] = [
  "none",
  "sm",
  "md",
  "lg",
];
export const DENSITY_PRESETS: readonly DensityPreset[] = [
  "compact",
  "comfortable",
  "spacious",
];
export const BORDER_WIDTH_PRESETS: readonly BorderWidthPreset[] = [
  "thin",
  "normal",
  "bold",
];
export const ELEVATION_PRESETS: readonly ElevationPreset[] = [
  "flat",
  "raised",
  "floating",
];
export const BUTTON_STYLE_PRESETS: readonly ButtonStylePreset[] = [
  "soft",
  "solid",
  "outline",
  "ghost",
];
export const CONTROL_STYLE_PRESETS: readonly ControlStylePreset[] = [
  "square",
  "rounded",
  "circle",
];

export function isRadiusPreset(v: unknown): v is RadiusPreset {
  return (RADIUS_PRESETS as readonly string[]).includes(v as string);
}
export function isDensityPreset(v: unknown): v is DensityPreset {
  return (DENSITY_PRESETS as readonly string[]).includes(v as string);
}
export function isBorderWidthPreset(v: unknown): v is BorderWidthPreset {
  return (BORDER_WIDTH_PRESETS as readonly string[]).includes(v as string);
}
export function isElevationPreset(v: unknown): v is ElevationPreset {
  return (ELEVATION_PRESETS as readonly string[]).includes(v as string);
}
export function isButtonStylePreset(v: unknown): v is ButtonStylePreset {
  return (BUTTON_STYLE_PRESETS as readonly string[]).includes(v as string);
}
export function isControlStylePreset(v: unknown): v is ControlStylePreset {
  return (CONTROL_STYLE_PRESETS as readonly string[]).includes(v as string);
}
