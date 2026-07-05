// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure day-grid math — the DOM-free core under `MonthGrid` / `DatePicker`.
// Day identity is a `DayKey`: the ISO `"YYYY-MM-DD"` string. It is
// serialization-safe (what an app stores is what the framework navigates),
// compares chronologically as a plain string, and all arithmetic on it runs
// on calendar fields projected onto the UTC day line (`Date.UTC`), never on
// local-time millisecond differences — a DST transition inside a month can't
// shear a grid row or a day count. Nothing here reads the clock: "today" is
// always a caller-supplied `DayKey`.

import type { CalendarDate } from "./date-math.ts";

/** A calendar day as its ISO `"YYYY-MM-DD"` string — serialization-safe day
 *  identity. Chronological order is plain string order. */
export type DayKey = string;

/** Day-of-week index in `Date.getDay()`'s numbering: 0 = Sunday … 6 =
 *  Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Render a `CalendarDate` as its `DayKey`. Out-of-range fields roll over
 *  Gregorian-correctly (Jan 32 → Feb 1), so the result is always a real
 *  day. */
export function toDayKey(date: CalendarDate): DayKey {
  return fromUtc(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

/** Parse a `DayKey` back into its fields, or null when the string isn't a
 *  real calendar day (`"2026-02-30"`, `"2026-7-4"`). */
export function parseDayKey(key: string): CalendarDate | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** The `DayKey` of a `Date`'s **local** calendar day — "today" as the user's
 *  wall clock sees it. The one place a clock value enters this module, and
 *  it enters as an argument. */
export function dayKeyOf(date: Date): DayKey {
  return toDayKey({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

// All arithmetic below round-trips through a UTC Date so the Gregorian rules
// (month lengths, leap years) come from the engine, not hand-rolled tables.
function toUtc(key: DayKey): Date | null {
  const parts = parseDayKey(key);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function fromUtc(d: Date): DayKey {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The day `n` days after (`n < 0`: before) the given one. An unparseable
 *  key returns unchanged. */
export function addDays(key: DayKey, n: number): DayKey {
  const d = toUtc(key);
  if (!d) return key;
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** The same day-of-month `n` months away, clamped to the target month's end
 *  when the day doesn't exist there (Jan 31 + 1 month → Feb 28/29 — never a
 *  rollover into March). An unparseable key returns unchanged. */
export function addMonths(key: DayKey, n: number): DayKey {
  const parts = parseDayKey(key);
  if (!parts) return key;
  const monthIndex = parts.month - 1 + n;
  const lastOfTarget = new Date(
    // Day 0 of the month after the target = the target's last day.
    Date.UTC(parts.year, monthIndex + 1, 0),
  );
  const day = Math.min(parts.day, lastOfTarget.getUTCDate());
  return fromUtc(new Date(Date.UTC(parts.year, monthIndex, day)));
}

/** The whole number of days from `a` to `b` (positive when `b` is later).
 *  NaN when either key is unparseable. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const da = toUtc(a);
  const db = toUtc(b);
  if (!da || !db) return Number.NaN;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** The first day of the week containing `key` (`weekStartsOn` in
 *  `Date.getDay()` numbering; defaults to 1, Monday — ISO-8601). An
 *  unparseable key returns unchanged. */
export function startOfWeek(key: DayKey, weekStartsOn: WeekStart = 1): DayKey {
  const d = toUtc(key);
  if (!d) return key;
  const offset = (d.getUTCDay() - weekStartsOn + 7) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return fromUtc(d);
}

/** The ISO-8601 week number (1–53) of the day — the week containing the
 *  year's first Thursday is week 1, so 29 Dec–3 Jan can belong to the other
 *  year's numbering. NaN for an unparseable key. */
export function isoWeek(key: DayKey): number {
  const d = toUtc(key);
  if (!d) return Number.NaN;
  // Move to the Thursday of this ISO week; its calendar year owns the week.
  const isoDay = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - isoDay + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstIsoDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDay + 3);
  return (
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  );
}

/** One cell of a month grid / week strip. */
export interface GridCell {
  key: DayKey;
  /** Day of month, 1-based — the number the cell paints. */
  day: number;
  /** False on the leading / trailing spill days of the adjacent months. */
  inMonth: boolean;
  /** True when the cell is the caller-supplied `today`. */
  isToday: boolean;
}

export interface MonthGridOptions {
  /** First day of the week, `Date.getDay()` numbering. Default 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** Always return six week rows so a paged UI keeps a stable height.
   *  Default false: four to six rows, whatever the month spans. */
  fixedWeeks?: boolean;
  /** The `DayKey` to flag `isToday` — caller-supplied, nothing reads the
   *  clock. */
  today?: DayKey;
}

/** The month's day cells as week rows, padded with the adjacent months'
 *  spill days so every row holds exactly seven. `month` is 1-based. */
export function buildMonthGrid(
  year: number,
  month: number,
  options: MonthGridOptions = {},
): GridCell[][] {
  const { weekStartsOn = 1, fixedWeeks = false, today } = options;
  const firstOfMonth = toDayKey({ year, month, day: 1 });
  let cursor = toUtc(startOfWeek(firstOfMonth, weekStartsOn));
  if (!cursor) return [];
  const monthIndex = month - 1;
  const weeks: GridCell[][] = [];
  for (;;) {
    const row: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = fromUtc(cursor);
      row.push({
        key,
        day: cursor.getUTCDate(),
        inMonth:
          cursor.getUTCFullYear() === year &&
          cursor.getUTCMonth() === monthIndex,
        isToday: key === today,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(row);
    const pastMonth =
      cursor.getUTCFullYear() > year ||
      (cursor.getUTCFullYear() === year && cursor.getUTCMonth() > monthIndex);
    if (fixedWeeks ? weeks.length === 6 : pastMonth) break;
  }
  return weeks;
}

/** The seven days of the week containing `anchor`, as grid cells (`inMonth`
 *  is relative to the anchor's month). The one-row agenda-strip form of
 *  {@link buildMonthGrid}. */
export function buildWeekStrip(
  anchor: DayKey,
  options: Omit<MonthGridOptions, "fixedWeeks"> = {},
): GridCell[] {
  const { weekStartsOn = 1, today } = options;
  const anchorParts = parseDayKey(anchor);
  const start = toUtc(startOfWeek(anchor, weekStartsOn));
  if (!anchorParts || !start) return [];
  const cells: GridCell[] = [];
  for (let i = 0; i < 7; i++) {
    const key = fromUtc(start);
    cells.push({
      key,
      day: start.getUTCDate(),
      inMonth:
        start.getUTCFullYear() === anchorParts.year &&
        start.getUTCMonth() === anchorParts.month - 1,
      isToday: key === today,
    });
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return cells;
}
