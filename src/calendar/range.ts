// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Inclusive day ranges over `DayKey`s. Because a `DayKey` compares
// chronologically as a plain string, everything here is bare string
// comparison — no Date construction, no time zones. The app owns what a
// range *means* (a stay, a sprint, a report window); these helpers own the
// set math a range picker needs.

import type { DayKey } from "./grid.ts";

/** An inclusive span of days: `start` ≤ `end`, both included. */
export interface DayRange {
  start: DayKey;
  end: DayKey;
}

/** Build a normalized range from two days in either order. */
export function dayRange(a: DayKey, b: DayKey): DayRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/** True when the day lies inside the range (inclusive at both ends). */
export function isInRange(key: DayKey, range: DayRange): boolean {
  return key >= range.start && key <= range.end;
}

/** The smallest range containing both the existing range and `key` — one
 *  more click extending a selection. `null` starts a fresh single-day
 *  range. */
export function extendRange(range: DayRange | null, key: DayKey): DayRange {
  if (!range) return { start: key, end: key };
  if (key < range.start) return { start: key, end: range.end };
  if (key > range.end) return { start: range.start, end: key };
  return range;
}
