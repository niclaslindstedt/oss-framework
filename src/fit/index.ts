// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public fit surface — **text that fits the box it is in**, in the two halves
// the problem actually has. `band.ts` picks a size from the string's length
// before anything is laid out (so the first paint is close and nothing
// flashes); `measure.ts` checks that guess against the room the layout really
// left, shrinks to fit, and says whether even the floor was too big — which is
// what lets a reading surface clamp and a writing surface refuse the keystroke
// that would overflow.
export {
  bandFontPx,
  fixedFontPx,
  resolveFontPx,
  scaleBand,
  TEXT_FITS,
  type SizeBand,
  type TextFit,
  type FixedTextFit,
} from "./band.ts";
export {
  textSlotHeight,
  textOverflowsWidth,
  textLineLimit,
  sizeLadder,
  fitTextSize,
  clipTextToBox,
  ellipsize,
  DEFAULT_LINE_HEIGHT,
  type TextFitResult,
} from "./measure.ts";
