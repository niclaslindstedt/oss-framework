<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/theme`

The shared theme engine and theme data for local-first PWAs — the preset
vocabulary, the per-preset palettes, the Custom-theme shape, the webfont
loaders, and the projection that paints all of it onto `<html>`.

It exists so that an app does not hand-roll (and slowly drift) its own
appearance system. The framework owns one canonical implementation; your app
keeps owning _where the user's choice is stored_.

```ts
import {
  useApplyTheme,
  THEMES,
  PRESET_PALETTES,
  customThemeSeed,
  coerceCustomTheme,
  type ThemePreset,
  type CustomTheme,
} from "@niclaslindstedt/oss-framework/theme";
```

## What the framework owns vs. what stays in your app

| Owned here (shared)                                                     | Stays in your app (app-specific)                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Preset ids, families, labels, `themeFamily` (`presets.ts`)              | The **appearance / settings store** that persists the user's choice    |
| Font families + stacks, font-scale steps, radius/density/border presets | The Appearance **UI** (picker, swatches, sliders) that reads this data |
| Colour-slot vocabulary + per-preset palettes (`palettes.ts`)            | Where values are persisted/synced (localStorage, a settings file, …)   |
| `CustomTheme` shape, defaults, `customThemeSeed`, `coerceCustomTheme`   | Any app-only settings that happen to live beside the theme code        |
| The projection engine: `useApplyTheme` + the pure `apply*` / `clear*`   | The CSS rules for the non-`custom` presets (`[data-theme="…"] { … }`)  |
| The webfont loaders (`fonts.ts`)                                        | The static import of the default `mono` font in your entry module      |

The **store is deliberately not part of this module.** An app's appearance
state is usually fused with concerns the framework knows nothing about (editor
preferences, layout, a synced achievements map, feature flags). The framework
gives you the _data_ and the _projection_; you keep owning _where the user's
choice lives_ and how it syncs.

## The CSS-variable contract

`useApplyTheme` writes exactly these to `document.documentElement`. Your token
stylesheet must read the same names — this is the contract your app lines up
against.

| What                | Written                                                                                                                                                                                                               | When                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Active preset       | `data-theme="<preset>"`                                                                                                                                                                                               | always                          |
| Font family         | `--app-font-family`                                                                                                                                                                                                   | always                          |
| Font scale          | `--app-font-scale`                                                                                                                                                                                                    | always                          |
| Colour slots (×18)  | `--page-bg`, `--surface`, `--surface-2`, `--surface-3`, `--fg`, `--fg-bright`, `--muted`, `--line`, `--accent`, `--meta`, `--link`, `--path`, `--flag`, `--pipe`, `--danger`, `--success`, `--positive`, `--negative` | only while `theme === "custom"` |
| Radius              | `--radius-sm`, `--radius-md`, `--radius-lg`                                                                                                                                                                           | only while `theme === "custom"` |
| Density row padding | `--density-row-py`, `--density-row-px`                                                                                                                                                                                | only while `theme === "custom"` |
| Border width        | `--border-width`                                                                                                                                                                                                      | only while `theme === "custom"` |
| Reduced motion      | `data-reduce-motion="true" \| "false"`                                                                                                                                                                                | only while `theme === "custom"` |

For every non-`custom` preset, **CSS owns the palette** (your
`[data-theme="dracula"] { … }` rules). The engine only sets `data-theme`; the
inline colour vars are written exclusively for the `custom` preset and removed
again the moment the user switches back to a preset (the engine tracks exactly
what it wrote, so there is no stale-variable list to maintain).

## Quick start

Mount `useApplyTheme` once near your root, fed by whatever store holds the
user's appearance. The engine is pure projection — it does not own state.

```tsx
import { useApplyTheme } from "@niclaslindstedt/oss-framework/theme";
import { useAppearance } from "./store/appearance"; // your store

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  const { theme, fontFamily, fontScale, customTheme } = useAppearance();
  useApplyTheme({ theme, fontFamily, fontScale, customTheme });
  return <>{children}</>;
}
```

Build an Appearance picker straight from the exported data:

```tsx
import {
  THEMES,
  THEME_LABELS,
  PRESET_PALETTES,
  customThemeSeed,
} from "@niclaslindstedt/oss-framework/theme";

// When the user switches into Custom, seed the editor from the look currently
// on screen so their first edit is a tweak, not a blank slate:
const seeded = customThemeSeed(currentTheme, prefersLightMediaQuery.matches);
```

Validate stored/synced data defensively when reading it back:

```ts
import {
  coerceCustomTheme,
  isThemePreset,
} from "@niclaslindstedt/oss-framework/theme";

const theme = isThemePreset(raw.theme) ? raw.theme : "dark";
const customTheme = coerceCustomTheme(raw.customTheme); // never throws
```

### Fonts

The default `mono` family is expected to be statically imported by your app's
entry module (so it precaches for offline first paint). The other three
families load on demand the first time they're selected — `useApplyTheme` calls
`loadFontFamily` for you. The font CSS comes from `@fontsource/*`, which are
**optional peer dependencies**: install the ones you use, or drop a loader and
ship your own font set.

```bash
npm install @fontsource/inter @fontsource/source-serif-4 @fontsource/opendyslexic
```

## API surface

- **`presets.ts`** — `ThemePreset`, `THEMES`, `DEFAULT_THEME`, `DARK_THEMES`,
  `LIGHT_THEMES`, `ThemeFamily`, `themeFamily`, `FAMILY_DEFAULT_THEME`,
  `THEME_LABELS`, `FAMILY_LABELS`, `isThemePreset`; `FontFamilyId`,
  `FONT_FAMILIES`, `DEFAULT_FONT_FAMILY`, `isFontFamily`; `FONT_SCALE_PRESETS`,
  `FONT_SCALES`, `MIN/MAX/DEFAULT_FONT_SCALE`, `isFontScale`; `RadiusPreset`,
  `DensityPreset`, `BorderWidthPreset` + their `*_PRESETS` lists and guards.
- **`palettes.ts`** — `CustomThemeColors`, `COLOR_KEYS`,
  `COLOR_KEY_TO_CSS_VAR`, `COLOR_LABELS`, `COLOR_GROUPS`, `PRESET_PALETTES`,
  `DEFAULT_CUSTOM_THEME_COLORS_DARK/LIGHT`.
- **`custom-theme.ts`** — `CustomTheme`, `DEFAULT_CUSTOM_THEME`,
  `customThemeSeed`, `coerceCustomTheme`.
- **`fonts.ts`** — `loadFontFamily`, `loadAllFontFamilies`.
- **`engine.ts`** — `useApplyTheme` (+ `ThemeAppearance`), and the pure
  primitives `applyThemePreset`, `applyFontFamily`, `applyFontScale`,
  `applyCustomTheme`, `clearCustomTheme`, plus the shape pixel maps
  `RADIUS_PX`, `DENSITY`, `BORDER_WIDTH_PX` for previewing concrete values.

## Migrating an existing theme implementation

The goal is that your app's theme code **shrinks to near-zero**: the palette
table, the `CustomTheme` shape, the validation, the font loaders, and the
projection all come from the framework. What remains app-side is the store and
the Appearance UI.

1. **Install the framework** and re-point your theme-data imports at it. If you
   want to minimise churn, keep your existing module path and make it a
   re-export:

   ```ts
   // src/theme/themes.ts (or wherever your theme data lived)
   export * from "@niclaslindstedt/oss-framework/theme";
   // …keep any genuinely app-specific (non-theme) exports below…
   ```

2. **Replace your projection hook** with a thin adapter over the engine so call
   sites keep working unchanged:

   ```ts
   import { useApplyTheme } from "@niclaslindstedt/oss-framework/theme";

   export function useTheme(appearance: YourAppearance): void {
     useApplyTheme({
       theme: appearance.theme,
       fontFamily: appearance.fontFamily,
       fontScale: appearance.fontScale,
       customTheme: appearance.customTheme,
     });
   }
   ```

   Delete your local radius/density/border maps and your per-property
   `useEffect`s — the engine owns them now.

3. **Point your settings types at the framework** (`ThemePreset`,
   `FontFamilyId`, `CustomTheme`) and fold `coerceCustomTheme` into your
   settings validator for the `customTheme` slice.

4. **Align your CSS** to the variable contract above, and your Appearance UI to
   `COLOR_GROUPS` / `COLOR_LABELS` / the `*_PRESETS` lists.

5. **Delete your font loaders** and import `loadFontFamily` /
   `loadAllFontFamilies` from the framework; keep the static `mono` import in
   your entry module.

## When your implementation only partially matches

Most adopters will _not_ match the framework's vocabulary exactly — your app
predates it, or pared it down, or extended it. A partial match is expected, not
a failure; here is how each mismatch shows up and how to reconcile it. **Audit
all of these before shipping** — a silent partial match is the main way theming
breaks after adoption.

- **You have fewer colour slots than the framework (18).** The Custom editor,
  if you drive it from `COLOR_GROUPS` / `COLOR_KEYS`, will render controls for
  slots your stylesheet never reads. The engine _will_ write those `--*` vars in
  `custom` mode, but nothing consumes them, so edits look inert.
  _Reconcile:_ either add the missing slots to your `palettes.css` and chrome so
  they do something, or render a reduced slot set in your editor (iterate your
  own subset of `COLOR_KEYS`) while still persisting a full `CustomTheme` — the
  extra slots simply carry their seeded defaults.

- **You have extra slots the framework lacks.** The framework's
  `CustomThemeColors` is fixed at 18; an app-specific colour the framework
  doesn't model can't ride inside `customTheme`.
  _Reconcile:_ keep that colour in your own settings, layered alongside the
  framework's `customTheme`, and project it with your own small effect — or
  propose widening the framework if the slot is genuinely shared. Do **not**
  fork the palette table to add it.

- **Your CSS variable names differ** (e.g. a single `--radius` instead of
  `--radius-sm/md/lg`, or `--color-accent` instead of `--accent`). The engine
  writes the framework's names; your old names stay unset, so custom mode paints
  nothing.
  _Reconcile:_ rename in your stylesheet to the contract above, or add an alias
  layer (`--radius: var(--radius-md);`) so existing rules keep resolving.
  Renaming is cleaner; aliasing is the low-risk interim step.

- **Your value mappings differ.** The framework's concrete pixels/rems
  (`RADIUS_PX`, `DENSITY`, `BORDER_WIDTH_PX`) may not equal what your app used
  for the same preset name, so "Medium radius" can shift visually after
  adoption.
  _Reconcile:_ accept the framework values (recommended — that's the point of
  converging), or override the specific `--*` vars in your own CSS after the
  engine sets them. Don't re-implement the maps.

- **Your stored shape differs** (missing `borderWidth`, an old flat colour
  object, a renamed field). Reading it straight into `useApplyTheme` risks
  `undefined` vars or a thrown read.
  _Reconcile:_ run every stored/synced value through `coerceCustomTheme(raw,
fallback)` on load — it fills missing or malformed slots from the fallback so
  a partial or legacy document never crashes the boot or paints a broken look.
  Seed the `fallback` from `customThemeSeed(currentPreset, prefersLight)` when
  you want missing colours to match the active look rather than the dark
  default.

- **You don't use a feature at all** (e.g. no border-width control, no reduced
  motion). Harmless — the engine still writes the var in custom mode, but if no
  rule reads it, it has no effect. Wire it up when you add the control; until
  then, ignore it.

## Verification

After wiring an app to the framework:

- Toggle through every preset — `data-theme` updates and the CSS palette
  paints; no inline colour vars linger on `<html>` (inspect the element).
- Switch to **Custom**, edit a colour / radius / density / border / motion —
  the matching `--*` var (or `data-reduce-motion`) appears; switch back to a
  preset and confirm it is removed.
- Change the font family to a non-`mono` option and confirm the webfont loads
  and `--app-font-family` updates.
- Reload with a partial/garbage stored appearance and confirm
  `coerceCustomTheme` falls back cleanly instead of throwing.
- Walk the partial-match checklist above and confirm every mismatch your app
  has is reconciled — no inert controls, no unset variables.
