// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public colour surface — the conversions a **mixer** needs (`convert.ts`) and
// the mixer itself (`ColorMixer`). A document stores `#rrggbb` because that is
// what a canvas and a CSS colour want; a person picking a colour thinks in
// hue, saturation and value, because that is the space where "the same colour
// but lighter" is a straight line. This module is the seam between the two.
//
// It is deliberately not a swatch grid — which swatches an app offers is the
// app's business; `ColorPalette` in `glyphs/` is one such grid, and the two
// compose.
export {
  normalizeHex,
  hexToHsv,
  hsvToHex,
  sameColor,
  withAlpha,
  relativeLuminance,
  contrastingInk,
  type Hsv,
} from "./convert.ts";
export {
  ColorMixer,
  DEFAULT_COLOR_MIXER_LABELS,
  type ColorMixerProps,
  type ColorMixerLabels,
} from "./ColorMixer.tsx";
