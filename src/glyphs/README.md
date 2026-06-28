<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `glyphs` — glyph + accent-colour picker kit

The "give this thing an icon and a colour" surface. When an app lets the user
brand an entity — a list, a workspace, a category, a project — with a small
icon and an accent hue, this module supplies the parts: a dependency-free
catalogue of inline glyphs, a renderer, the two presentational pickers, and a
favicon builder that re-badges the tab to the active entity's icon.

```ts
import {
  Glyph,
  GlyphPicker,
  ColorPalette,
  GLYPH_NAMES,
  GLYPH_COLORS,
  DEFAULT_GLYPH,
  glyphDataUri,
} from "@niclaslindstedt/oss-framework/glyphs";
```

## What it owns vs. what stays in your app

The module owns **the catalogue, the rendering, and the picker chrome**. The
_choice_ — which glyph and which colour an entity carries — lives in **your
app's store**, exactly like every other extracted module's seam. The pickers
are presentational: you hand them the current value and a change handler; they
never persist anything.

| In the framework                                 | In your app                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| `GLYPH_PATHS` catalogue + `DEFAULT_GLYPH`        | the entity's stored `glyph` / `color` fields    |
| `Glyph` renderer, `GlyphPicker` / `ColorPalette` | wiring the pickers to a store action            |
| `glyphSvg` / `glyphDataUri` favicon builders     | when to swap the favicon (e.g. on active swap)  |
| `GLYPH_COLORS` default palette                   | a custom palette, if you'd rather pass your own |

## The contract

- **Glyphs are inline SVG markup**, authored on a 24×24 grid at lucide weight,
  stored as the _inner_ markup only (no wrapper `<svg>`). `Glyph` wraps a name
  in a `currentColor` `<svg>`; `glyphSvg` serialises one into a standalone badge.
- **`Glyph` paints with `currentColor`** — tint it with a text-colour class
  (`className="text-accent"`) or an inline `color` style. `GlyphPicker` does the
  latter from its `tintColor` prop.
- **The pickers carry no i18n** — every user-facing string injects as a prop
  (`noneLabel`, `ariaLabelPrefix`) with no built-in default, so you pass your
  own translated labels.
- **`GLYPH_NAMES` omits `DEFAULT_GLYPH`** — the picker's leading "clear" cell
  already stands for the default, so the default name is not offered twice.
- **Both pickers are keyboard-navigable radiogroups.** They own a
  [roving tabindex](../hooks/README.md#userovingtabindex--usegridrovingtabindex)
  internally: the selected cell is the single Tab stop, and the arrow keys move
  within the group (`GlyphPicker` walks its 8-column grid in 2-D; `ColorPalette`
  cycles its swatches), with Home/End jumping to the ends. Enter/Space picks the
  focused cell. You wire nothing for this — it's built in.

## Quick start

Store a `glyph` (a name, or `null` for the default) and a `color` on the
entity, then compose an appearance editor:

```tsx
function AppearanceEditor({ glyph, color, onChange }) {
  return (
    <>
      <ColorPalette
        colors={GLYPH_COLORS}
        value={color}
        onChange={(c) => onChange({ color: c })}
        ariaLabelPrefix="Colour"
      />
      <GlyphPicker
        glyphs={GLYPH_NAMES}
        value={glyph}
        onChange={(g) => onChange({ glyph: g })}
        tintColor={color}
        noneLabel="Default icon"
        ariaLabelPrefix="Icon"
      />
    </>
  );
}

// Draw the chosen icon anywhere, tinted by the accent:
<Glyph name={glyph ?? DEFAULT_GLYPH} style={color ? { color } : undefined} />;

// Re-badge the favicon to the active entity (transparent badge by default;
// pass `{ background }` for a filled badge that matches your app icon):
link.href = glyphDataUri(glyph ?? DEFAULT_GLYPH, color ?? "#888");
```

## API

| Export                         | Kind      | Notes                                                                |
| ------------------------------ | --------- | -------------------------------------------------------------------- |
| `Glyph`                        | component | `{ name?, className?, style? }` — inline SVG, falls back to default. |
| `GlyphPicker`                  | component | grid radiogroup (roving tabindex); leading cell clears to default.   |
| `ColorPalette`                 | component | swatch radiogroup (roving tabindex); arrow keys cycle the swatches.  |
| `GLYPH_PATHS`                  | data      | `name → inner SVG markup`.                                           |
| `DEFAULT_GLYPH`                | data      | the fallback glyph name (`"folder"`).                                |
| `GLYPH_NAMES`                  | data      | pickable names, default omitted.                                     |
| `GLYPH_COLORS`                 | data      | 16-hue default accent palette.                                       |
| `isGlyphName(name)`            | guard     | narrows a stored string to a drawable name.                          |
| `glyphSvg(name, color, opts?)` | util      | standalone badge SVG string (`GlyphBadgeOptions`).                   |
| `glyphDataUri(name, color, …)` | util      | the same, as an `image/svg+xml` data URI for a favicon `href`.       |

`GlyphBadgeOptions`: `{ size?, radius?, background?, padding? }` — the badge
defaults to **transparent** (just the stroked glyph); pass `background` for a
filled badge.

## Migrating an existing icon picker

If your app already has a home-grown "pick an icon + colour" surface (often a
`<SomethingGlyph>` component, a `GlyphGrid`, and a colour swatch row), the move
is mechanical:

- **Delete the local glyph catalogue, the renderer, and the two pickers**;
  import `Glyph`, `GlyphPicker`, `ColorPalette` from `/glyphs`.
- **Replace `t("…")` calls with the `noneLabel` / `ariaLabelPrefix` props** —
  pass your translated strings in.
- **Point the favicon builder at `glyphDataUri`.** If your old builder painted a
  filled badge (e.g. `#1f2933` to match your `favicon.svg`), pass it as
  `{ background: "#1f2933" }` so the icon still reads as your app, re-badged.
- The stored `glyph` / `color` on your entity, and the store action that writes
  them, **stay exactly as they are** — only the rendering moves.

### Partial match

Most adopters won't match the framework one-to-one. The mismatches and how to
reconcile each:

- **Your catalogue has glyphs the framework lacks.** Don't drop them — add their
  inner markup to a local map and render with your own `<Glyph>`-style wrapper
  for the extras, or propose widening `GLYPH_PATHS`. The framework's catalogue is
  a superset of what its source apps shipped, but it isn't exhaustive.
- **The framework offers glyphs you don't want.** Pass a narrowed list to
  `GlyphPicker` (`glyphs={GLYPH_NAMES.filter(...)}`) — the renderer still draws
  any stored name, the picker just doesn't offer the ones you omit.
- **Your default glyph differs** (you draw a different "no custom icon" shape).
  `DEFAULT_GLYPH` is `"folder"`; if yours differs, render your own fallback in
  the renderer call (`name={glyph ?? "myDefault"}`) and pass a matching
  `GlyphPicker` clear-cell — or add your default to the catalogue and filter it
  out of the offered list as the framework does.
- **You want a different palette.** `ColorPalette` takes any `colors` array;
  `GLYPH_COLORS` is only the default. Pass your own and nothing else changes.
- **Your favicon badge geometry differs** (size, corner radius, padding). Tune
  `GlyphBadgeOptions` rather than forking the builder.
- **Store-shape differences.** The pickers are presentational; whatever shape
  your store keeps `glyph`/`color` in, you adapt at the `value`/`onChange` seam,
  not inside the module.

## Verification

After wiring, confirm: the picker highlights the stored glyph and colour on
open; picking the leading cell clears back to the default icon; the chosen
colour tints both the selected picker cell and the rendered `Glyph`; and (if
used) the favicon swaps to the active entity's badge. The pickers are
roving-tabindex radiogroups — Tab lands on the selected cell (a single Tab
stop), the arrow keys then move focus within the group (Home/End jump to the
ends), and the `aria-checked` state tracks the selection for assistive tech.
