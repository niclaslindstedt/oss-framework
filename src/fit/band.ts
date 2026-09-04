// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The **size band** a piece of text is set in, and the curve that picks a size
// from it before anything has been laid out.
//
// This is half of "text that fits the box it is in". The other half
// (`measure.ts`) reads the DOM; this half runs before there is a DOM to read,
// which is why it exists at all: a first render that guesses badly and is
// corrected in a layout effect is a visible flash, so the guess wants to be
// close. It is a pure function of the text's *length*, which is all that is
// knowable pre-layout, and it is deliberately not the answer — the measured
// pass has the last word either way.
//
// A band is `[minPx, maxPx]` plus the two character counts the ramp runs
// between: a short string is set at the top of the band, and past `startAt` it
// shrinks linearly to the floor at `floorAt`. Each surface carries its own
// band, because "large" in a 47 px cell is not "large" in a full-width row.

/** How a surface sizes its text: the band, and where the ramp runs. */
export interface SizeBand {
  /** Size for a near-empty string, in px. */
  maxPx: number;
  /** Hard floor — below this the text is unreadable, in px. */
  minPx: number;
  /** Character count at which the shrink starts. */
  startAt: number;
  /** Character count at which the floor is reached. */
  floorAt: number;
}

/** How the text is sized: by the curve, or pinned at one of three steps. */
export type TextFit = "auto" | "small" | "medium" | "large";

export const TEXT_FITS: readonly TextFit[] = [
  "auto",
  "small",
  "medium",
  "large",
];

export type FixedTextFit = Exclude<TextFit, "auto">;

/** Where the two upper steps sit in the band, as a fraction of it.
 *
 *  The steps take most of the band rather than bunching into its bottom.
 *  That is worth stating because the obvious arrangement is the wrong one: a
 *  ladder pinned low puts "large" several points below the size the curve
 *  itself uses for a short string, so the user's own top step is smaller than
 *  what the surface prints unasked. Whatever a ceiling is for, it is not to
 *  keep the reader's largest choice well under it. */
const FIXED_STEPS: Record<Exclude<FixedTextFit, "small">, number> = {
  medium: 0.45,
  large: 0.85,
};

/** The gap between `small` and `medium`, as a share of the band.
 *
 *  A share rather than a flat number of points: a point is a fifth of a narrow
 *  surface's band and a sixteenth of a wide one's, so one number would make
 *  the smallest step nearly invisible exactly where there is most room to show
 *  it. */
const SMALL_DROP = 0.25;

function round1(px: number): number {
  return Math.round(px * 10) / 10;
}

/** The size (px) for a string of `length` characters: `maxPx` up to `startAt`,
 *  then a linear ramp down to `minPx` at `floorAt`, clamped at both ends. */
export function bandFontPx(length: number, band: SizeBand): number {
  if (length <= band.startAt) return band.maxPx;
  if (length >= band.floorAt) return band.minPx;
  const t = (length - band.startAt) / (band.floorAt - band.startAt);
  return round1(band.maxPx - (band.maxPx - band.minPx) * t);
}

/** The pinned size (px) for one of the three steps within the band. */
export function fixedFontPx(size: FixedTextFit, band: SizeBand): number {
  const at = (fraction: number) =>
    band.minPx + (band.maxPx - band.minPx) * fraction;
  if (size === "small") {
    return round1(Math.max(band.minPx, at(FIXED_STEPS.medium - SMALL_DROP)));
  }
  return round1(at(FIXED_STEPS[size]));
}

/** The size a string renders at: the curve on `auto`, the pinned step
 *  otherwise. This is what a component calls. */
export function resolveFontPx(
  length: number,
  band: SizeBand,
  size: TextFit,
): number {
  return size === "auto" ? bandFontPx(length, band) : fixedFontPx(size, band);
}

/** The same band, scaled.
 *
 *  Every number in a band is a *measurement* — taken on one screen, against
 *  one surface width — so an app that scales its type (for a bigger screen, or
 *  because the reader asked) has to carry the band along with everything else,
 *  or that one piece stays at the measured size while the layout around it
 *  grows. A factor of 1, or anything that isn't a positive finite number,
 *  hands the band straight back.
 *
 *  The character counts are deliberately left alone: they say when a string is
 *  long enough to want shrinking, which is a fact about the string rather than
 *  about the screen. */
export function scaleBand(band: SizeBand, factor: number): SizeBand {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  if (f === 1) return band;
  return {
    ...band,
    maxPx: round1(band.maxPx * f),
    minPx: round1(band.minPx * f),
  };
}
