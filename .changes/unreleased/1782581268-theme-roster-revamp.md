---
type: Changed
title: Revamped, more distinct theme roster
breaking: true
---

`theme`: replaced the near-identical editor palettes with a curated, deliberately distinct roster — each is a different temperature / mood rather than one scheme recoloured. **Dark:** `githubDark` (the default — neutral monospaced "dev" look), `nord` (cool arctic blue), `dracula` (vivid purple), `gruvbox` (warm retro amber), `solarizedDark` (teal/scholarly). **Light:** `githubLight` (crisp high-contrast) and `solarizedLight` (warm paper). Every body-text pair clears WCAG AA (≥4.5:1) and every accent ≥3:1. **Breaking:** the `dark`, `light`, `monokai`, `quietLight`, and `excel` presets are removed and `DEFAULT_THEME` is now `githubDark`; a stored value of a dropped id fails `isThemePreset` and should fall back to the default. The `DEFAULT_CUSTOM_THEME_COLORS_DARK` / `_LIGHT` seeds now derive from GitHub Dark / GitHub Light.
