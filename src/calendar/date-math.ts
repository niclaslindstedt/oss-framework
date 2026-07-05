// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure recurring-date math — the DOM-free core of the calendar module. An app
// often stores a notable date as a plain string that may or may not know its
// year: a full ISO `YYYY-MM-DD` when the year is known (e.g. a date of birth,
// a founding date), or a bare `MM-DD` when only the month and day matter (e.g.
// a name day). This module is the pure seam over that shape: parse it, tell
// how many whole years have passed, and how many days remain until the next
// yearly occurrence.
//
// Every function takes the reference "now" as an argument — nothing reads the
// clock — so the whole surface is deterministic and unit-testable in node.
// Day arithmetic runs on calendar fields projected onto the UTC day line
// (`Date.UTC`), never on local-time millisecond differences, so a DST
// transition between now and the next occurrence can't shear a day count.

/** A concrete calendar day: full year, 1-based month, 1-based day of month. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** A parsed year-optional date: month and day always, year only when the
 *  stored value carried one (`YYYY-MM-DD`); a yearless `MM-DD` leaves it
 *  null. */
export interface DateParts {
  year: number | null;
  month: number;
  day: number;
}

// Validate a month/day pair against a leap year (2000) so 29 February is
// accepted for a yearless value — it's a real calendar day, just not in every
// year.
function isRealMonthDay(month: number, day: number): boolean {
  const probe = new Date(Date.UTC(2000, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** Parse a stored date string into its parts, or null when it isn't a real
 *  date. Accepts a full ISO `YYYY-MM-DD` (year known) or a bare `MM-DD` (day
 *  and month only). Rejects impossible days like `2001-02-30` or `13-40`. */
export function parseDateParts(value: string): DateParts | null {
  const s = value.trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day
    ) {
      return { year, month, day };
    }
    return null;
  }
  const short = /^(\d{2})-(\d{2})$/.exec(s);
  if (short) {
    const month = Number(short[1]);
    const day = Number(short[2]);
    if (isRealMonthDay(month, day)) return { year: null, month, day };
  }
  return null;
}

/** Sequential day number of a calendar day on the UTC day line. `Date.UTC`
 *  knows no DST, so a difference of two of these is always a whole number of
 *  calendar days. Out-of-range fields roll over Gregorian-correctly (Jan 32 →
 *  Feb 1). */
function dayNumber(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day) / 86_400_000;
}

/** Whole years elapsed since the date, as of `now` — an age, a "married N
 *  years" readout. null when the value is invalid, carries no year, or lies
 *  in the future (nothing has elapsed yet). The day itself counts as a
 *  completed year. */
export function yearsSince(value: string, now: Date): number | null {
  const p = parseDateParts(value);
  if (!p || p.year === null) return null;
  const monthNow = now.getMonth() + 1;
  const passedThisYear =
    monthNow > p.month || (monthNow === p.month && now.getDate() >= p.day);
  const years = now.getFullYear() - p.year - (passedThisYear ? 0 : 1);
  return years < 0 ? null : years;
}

/** The next yearly occurrence of the date's month/day on or after `now`'s
 *  calendar day: today when it falls on the day itself, otherwise the nearest
 *  future one. Year-agnostic — a dated and a yearless value behave the same.
 *  A 29 February rolls onto 1 March in common years. null when the value
 *  isn't a real date. */
export function nextOccurrence(value: string, now: Date): CalendarDate | null {
  const p = parseDateParts(value);
  if (!p) return null;
  const today = dayNumber(now.getFullYear(), now.getMonth(), now.getDate());
  // Built from fields so Feb 29 rolls to Mar 1 when this year isn't a leap
  // year.
  let next = new Date(Date.UTC(now.getFullYear(), p.month - 1, p.day));
  if (next.getTime() / 86_400_000 < today) {
    next = new Date(Date.UTC(now.getFullYear() + 1, p.month - 1, p.day));
  }
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/** Days until the next yearly occurrence of the date: 0 on the day itself, 1
 *  the day before, counting forward to the same month/day next year once this
 *  year's has passed. null when the value isn't a real date. */
export function daysUntilNextOccurrence(
  value: string,
  now: Date,
): number | null {
  const next = nextOccurrence(value, now);
  if (!next) return null;
  return (
    dayNumber(next.year, next.month - 1, next.day) -
    dayNumber(now.getFullYear(), now.getMonth(), now.getDate())
  );
}
