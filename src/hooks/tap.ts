// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Tap arithmetic: what counts as a tap, and what counts as two of them.
//
// For a surface that handles its own pointer stream — a canvas, a map, a grid
// that draws rather than lays out DOM per cell — the browser's own `dblclick`
// is not enough. On touch it is synthesised inconsistently, it arrives *after*
// the two presses that produced it (by which time the surface has already
// acted on both), and it says nothing about how far the finger travelled. So
// such a surface detects taps from the pointer events it is already handling,
// and this is the pure half of that: no DOM, no refs, driveable from a node
// test.
//
// The thresholds are deliberately conservative in the direction that costs
// least. A missed double-tap costs a second try; a false positive on a drag
// yanks the view out from under someone who was panning.
//
// Gesture *recognition* the framework already ships as hooks — `useLongPress`
// for press-and-hold on an element, `useRowSwipe` for a row's flick — reaches
// for these same numbers, so an app that has to recognise one itself lands on
// the same feel as the ones it did not.

/** A point in whatever space the caller is measuring in — client pixels,
 *  usually. */
export interface TapPoint {
  x: number;
  y: number;
}

/** A press that has been released without wandering: when, and where. */
export interface Tap {
  /** Milliseconds on any monotonic clock — an event's `timeStamp` will do. */
  time: number;
  point: TapPoint;
}

/** How far a pointer may travel between press and release and still be a tap
 *  rather than a drag, in CSS pixels. Below a finger's own wobble. */
export const TAP_SLOP = 8;

/** How long after a tap a second one still pairs with it, in milliseconds.
 *  Roughly the platform double-click threshold. */
export const DOUBLE_TAP_MS = 320;

/** How far apart two taps may land and still be a pair, in CSS pixels.
 *  Generous enough for a thumb on a phone, tight enough that two deliberate
 *  taps in different places stay two taps. */
export const DOUBLE_TAP_SLOP = 32;

/** How long a finger must stay put before a press counts as a long one, in
 *  milliseconds — the platform's own threshold, and `useLongPress`'s default,
 *  so a hand that has learnt one has learnt both. */
export const LONG_PRESS_MS = 500;

/** Plain Euclidean distance between two points. */
export function tapDistance(a: TapPoint, b: TapPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Whether a press that began at `from` and has reached `to` still counts as a
 *  tap.
 *
 *  Once it doesn't, it is a drag for good: a caller should drop the tap rather
 *  than re-test it when the finger wanders back, which is what keeps a slow
 *  circling drag from ending in a tap it never was. */
export function isTap(from: TapPoint, to: TapPoint, slop = TAP_SLOP): boolean {
  return tapDistance(from, to) <= slop;
}

/** Whether `tap` closes a double-tap with `previous` — near enough in both
 *  time and place.
 *
 *  A `null` previous (no earlier tap, or one already consumed) is never a
 *  pair, so a caller can keep "the last tap, or nothing" in one slot and clear
 *  it the moment a pair fires. */
export function isDoubleTap(previous: Tap | null, tap: Tap): boolean {
  if (!previous) return false;
  if (tap.time - previous.time > DOUBLE_TAP_MS) return false;
  return tapDistance(previous.point, tap.point) <= DOUBLE_TAP_SLOP;
}
