---
type: Added
title: Global UI style & component flavours
breaking: true
---

`theme`: the appearance gains a `ui: UiStyle` slice of global look knobs that apply to **every** theme, not just Custom — corner radius, row density, border width, reduced motion (promoted out of `customTheme`), plus three new "flavour" axes: button treatment (`soft` / `solid` / `outline` / `ghost`), checkbox shape (`square` / `rounded` / `circle`), and elevation / shadow depth (`flat` / `raised` / `floating`). The engine projects these as the `--control-radius` var and the `data-button-style` / `data-control-style` / `data-elevation` attributes (host CSS owns their paint, like `[data-theme]` palettes); `Button` advertises `data-ui`/`data-variant` and `Checkbox` reads `--control-radius`. `AppearancePicker` shows the new Shape & Components sections on all themes. **Breaking:** `CustomTheme` is now just `{ colors }` (its `radius` / `density` / `borderWidth` / `reduceMotion` moved to `UiStyle`); `ThemeAppearance` requires `ui`. Run stored documents through the new `coerceUiStyle` (it accepts a legacy `customTheme` object, so they migrate forward for free).
