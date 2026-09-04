// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The arithmetic a **yearly observance rule** is written in.
//
// A date that recurs every year is rarely a fixed `MM-DD`. Half the entries in
// any country's public-holiday table are written as rules instead — "the first
// Monday of May", "the Saturday between 20 and 26 June", "thirty-nine days
// after Easter" — and an app that wants to print them has to resolve each rule
// against the year it is showing. That resolution is what this module is: the
// four or five expressions those tables are actually written in, each a pure
// function of a year.
//
// Easter is here because it is the anchor half of them hang off. It is not a
// rule over the Gregorian calendar at all — it is the lunisolar computus, and
// there is exactly one right answer to it — so an app that computes it itself
// is an app that will eventually get a year wrong. Good Friday, Ascension,
// Whitsun, Corpus Christi and the Nordic countries' midsummer are all "Easter
// plus n" or "the first weekday on or after a date"; both are below.
//
// Deliberately in **calendar fields** rather than in `DayKey` strings or
// `Date`s. A rule is a statement about a month and a day of a month, the year
// is the parameter, and keeping it in fields means nothing here can be sheared
// by a time zone: every intermediate `Date` is built at UTC noon, which is the
// one instant of a day that survives every offset on earth.

/** A day of a year, without the year: 1-based month, 1-based day of month —
 *  what a rule resolves to once a year is supplied. */
export interface MonthDay {
  month: number;
  day: number;
}

/** Easter Sunday (Gregorian) for a year — the anonymous Meeus/Jones/Butcher
 *  computus, which is exact for every year of the Gregorian calendar.
 *
 *  Western Easter: the Orthodox reckoning runs on the Julian calendar and is a
 *  different function, not a variant of this one. */
export function easterSunday(year: number): MonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** The day `offset` days after a day of `year` — how "Easter plus 39" and
 *  every other offset rule is written.
 *
 *  The result keeps `year`'s calendar: an offset that walks off either end of
 *  the year still reports the month and day it lands on, which is what a table
 *  written as "the second day of Christmas" wants. */
export function addToMonthDay(
  year: number,
  month: number,
  day: number,
  offset: number,
): MonthDay {
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** The weekday (0 = Sunday … 6 = Saturday, as `Date.getDay()`) a day of the
 *  year falls on. */
export function weekdayOfMonthDay(
  year: number,
  month: number,
  day: number,
): number {
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

/** The first `weekday` on or after a day — the shape of every "the Saturday
 *  between 20 and 26 June" rule, whose window is always exactly a week wide
 *  and so is settled by its first day alone. */
export function weekdayOnOrAfter(
  year: number,
  month: number,
  day: number,
  weekday: number,
): MonthDay {
  const shift = (weekday - weekdayOfMonthDay(year, month, day) + 7) % 7;
  return addToMonthDay(year, month, day, shift);
}

/** The `n`th (1-based) `weekday` of a month — "the first Monday of May". */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): MonthDay {
  const first = weekdayOnOrAfter(year, month, 1, weekday);
  return addToMonthDay(year, first.month, first.day, (n - 1) * 7);
}

/** The last `weekday` of a month — "the last Monday of August". */
export function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
): MonthDay {
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const back = (weekdayOfMonthDay(year, month, lastDay) - weekday + 7) % 7;
  return { month, day: lastDay - back };
}
