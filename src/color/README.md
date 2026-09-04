<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `color` — mixing a colour

A document stores plain `#rrggbb`; a person picking a colour thinks in hue,
saturation and value, because that is the space where "the same colour but
lighter" is a straight line. This module is the seam between the two.

```tsx
const [hsv, setHsv] = useState(() => hexToHsv(ink));

<ColorMixer
  value={hsv}
  onChange={(next) => {
    setHsv(next);
    onPick(hsvToHex(next));
  }}
/>;
```

**Hold the value as `Hsv`, not as hex.** A hex round trip on every pointer move
quantises the drag: a colour with no light in it has no hue left to carry, so
pulling the value handle to the bottom of the field and back would not return
the hue it started at. Convert once, when you store something.

`ColorMixer` is deliberately not a swatch grid — which swatches an app offers is
the app's business. `ColorPalette` (in `glyphs/`) is one such grid, and the two
compose: swatches above, the mixer folded away below.

Also here: `normalizeHex` (case, the short form, a missing `#`), `sameColor`,
`withAlpha` for a gradient stop that has to carry its own opacity, and
`relativeLuminance` / `contrastingInk` for the label that has to read _on_ a
colour.
