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
  // GitHub Dark — the default. Neutral cool-grey, near-black surfaces: the
  // monospaced "dev editor" look.
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
  // Tokyo Night — deep navy/indigo with blue, cyan and violet accents. Darker
  // and more saturated than GitHub Dark; the late-night coding look.
  tokyoNight: {
    pageBg: "#16161e",
    surface: "#1a1b26",
    surface2: "#292e42",
    surface3: "#13131a",
    fg: "#c0caf5",
    fgBright: "#ffffff",
    muted: "#828bb8",
    line: "#3b4261",
    accent: "#9ece6a",
    meta: "#e0af68",
    link: "#7aa2f7",
    path: "#7dcfff",
    flag: "#ff9e64",
    pipe: "#bb9af7",
    danger: "#f7768e",
    success: "#9ece6a",
    positive: "#b9e08a",
    negative: "#fb9aac",
  },
  // Nord — cool arctic blue-grey, soft and low-saturation. A markedly lighter,
  // bluer base than GitHub Dark.
  nord: {
    pageBg: "#2e3440",
    surface: "#3b4252",
    surface2: "#434c5e",
    surface3: "#272c36",
    fg: "#e5e9f0",
    fgBright: "#eceff4",
    muted: "#abb3c4",
    line: "#4c566a",
    accent: "#a3be8c",
    meta: "#ebcb8b",
    link: "#88c0d0",
    path: "#8fbcbb",
    flag: "#d08770",
    pipe: "#b48ead",
    danger: "#d6868f",
    success: "#a3be8c",
    positive: "#bcd6a6",
    negative: "#e0a8af",
  },
  // Dracula — purple-tinted surfaces with vivid pink / cyan / green accents.
  // The high-energy, saturated option.
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
  // Catppuccin Mocha — soft pastel lavender base with rounded, gentle accents.
  // Warmer and lower-contrast than Dracula; the cosy pastel option.
  catppuccin: {
    pageBg: "#181825",
    surface: "#1e1e2e",
    surface2: "#313244",
    surface3: "#11111b",
    fg: "#cdd6f4",
    fgBright: "#ffffff",
    muted: "#a6adc8",
    line: "#45475a",
    accent: "#a6e3a1",
    meta: "#f9e2af",
    link: "#89b4fa",
    path: "#94e2d5",
    flag: "#fab387",
    pipe: "#cba6f7",
    danger: "#f38ba8",
    success: "#a6e3a1",
    positive: "#bdebb8",
    negative: "#f7a8be",
  },
  // Rosé Pine — muted rose / plum on a dark indigo base, with gold and foam
  // accents. A distinctly warm-cool blend unlike anything else in the set.
  rosePine: {
    pageBg: "#191724",
    surface: "#1f1d2e",
    surface2: "#26233a",
    surface3: "#15131f",
    fg: "#e0def4",
    fgBright: "#ffffff",
    muted: "#908caa",
    line: "#403d52",
    accent: "#9ccfd8",
    meta: "#f6c177",
    link: "#c4a7e7",
    path: "#7fb3bd",
    flag: "#ea9a97",
    pipe: "#c4a7e7",
    danger: "#eb6f92",
    success: "#9ccfd8",
    positive: "#b5dde4",
    negative: "#f0a3b8",
  },
  // Gruvbox — warm retro browns with amber / orange / olive accents. The only
  // warm-temperature dark in the set, so it reads completely differently from
  // the cool blues.
  gruvbox: {
    pageBg: "#1d2021",
    surface: "#282828",
    surface2: "#3c3836",
    surface3: "#1b1b1b",
    fg: "#ebdbb2",
    fgBright: "#fbf1c7",
    muted: "#a89984",
    line: "#504945",
    accent: "#b8bb26",
    meta: "#fabd2f",
    link: "#83a598",
    path: "#8ec07c",
    flag: "#fe8019",
    pipe: "#d3869b",
    danger: "#fb4934",
    success: "#b8bb26",
    positive: "#c8cb4a",
    negative: "#fb6f5f",
  },
  // Solarized Dark — the unmistakable teal/cyan base with its precise accent
  // wheel. Scholarly and balanced.
  solarizedDark: {
    pageBg: "#002b36",
    surface: "#073642",
    surface2: "#0a4554",
    surface3: "#00212b",
    fg: "#a7b6b6",
    fgBright: "#eee8d5",
    muted: "#94a4a4",
    line: "#1a5363",
    accent: "#9aad00",
    meta: "#c79a18",
    link: "#3a9fe0",
    path: "#2aa198",
    flag: "#d4622a",
    pipe: "#8a8fd6",
    danger: "#ef5d59",
    success: "#9aad00",
    positive: "#b3c83a",
    negative: "#f06b67",
  },
  // GitHub Light — crisp, high-contrast neutral light. The default light.
  githubLight: {
    pageBg: "#f6f8fa",
    surface: "#ffffff",
    surface2: "#eaeef2",
    surface3: "#d0d7de",
    fg: "#1f2328",
    fgBright: "#0d1117",
    muted: "#656d76",
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
  // Catppuccin Latte — soft cool-grey pastel light. The accents are darkened
  // from the upstream palette so text on the near-white surface stays legible.
  catppuccinLatte: {
    pageBg: "#e6e9ef",
    surface: "#eff1f5",
    surface2: "#dce0e8",
    surface3: "#ccd0da",
    fg: "#4c4f69",
    fgBright: "#1e2030",
    muted: "#5c5f72",
    line: "#bcc0cc",
    accent: "#2e8a1f",
    meta: "#8c6a00",
    link: "#1e66f5",
    path: "#117c82",
    flag: "#c4540a",
    pipe: "#8839ef",
    danger: "#d20f39",
    success: "#2e8a1f",
    positive: "#4a8a26",
    negative: "#cc2a4e",
  },
  // Rosé Pine Dawn — warm rosy "dawn" light. Accents darkened from upstream so
  // they clear AA on the cream surface.
  rosePineDawn: {
    pageBg: "#faf4ed",
    surface: "#fffaf3",
    surface2: "#f2e9e1",
    surface3: "#efe6dc",
    fg: "#575279",
    fgBright: "#4a4463",
    muted: "#6b6782",
    line: "#dfdad9",
    accent: "#4e8791",
    meta: "#9a6a12",
    link: "#286983",
    path: "#82709c",
    flag: "#bd5f5a",
    pipe: "#82709c",
    danger: "#b4637a",
    success: "#4e8791",
    positive: "#4f7d60",
    negative: "#bd5577",
  },
  // Solarized Light — warm cream "paper". A softer, low-glare light that
  // contrasts with GitHub Light's pure white.
  solarizedLight: {
    pageBg: "#eee8d5",
    surface: "#fdf6e3",
    surface2: "#f5efdc",
    surface3: "#e3ddc9",
    fg: "#48606a",
    fgBright: "#073642",
    muted: "#4f666e",
    line: "#d6cfb8",
    accent: "#6b7a00",
    meta: "#9a7400",
    link: "#1c70bf",
    path: "#247f78",
    flag: "#bf451a",
    pipe: "#5b60b3",
    danger: "#cc2722",
    success: "#6b7a00",
    positive: "#5c7f00",
    negative: "#c42d75",
  },
};

// GitHub Dark is the Custom theme's pristine default and a validator's fallback
// for a missing colour; GitHub Light is the light-mode seed. Both are referenced
// by name elsewhere, so they keep a named alias derived from the table above.
export const DEFAULT_CUSTOM_THEME_COLORS_DARK = PRESET_PALETTES.githubDark;
export const DEFAULT_CUSTOM_THEME_COLORS_LIGHT = PRESET_PALETTES.githubLight;
