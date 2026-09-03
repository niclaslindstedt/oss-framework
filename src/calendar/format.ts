// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Rendering a `DayKey`. The rest of the calendar module speaks `YYYY-MM-DD`
// throughout — sortable, timezone-free, comparable as a string — and this is
// where one turns into something a person reads.
//
// It is a thin layer over `format/datetime.ts` on purpose, and the thin part
// is the point: a `DayKey` is a *calendar* day rather than an instant, so it
// has to be read back as local midnight before an `Intl` formatter sees it.
// Doing that with `new Date(key)` instead parses the string as UTC, which
// puts every day one to the left for anyone west of Greenwich — a bug that
// only shows up for some readers, in some months, which is exactly the kind
// that survives review. So the conversion exists once, here, and the
// formatters below are the only supported way to get from a key to a label.
//
// Locale is always a parameter (`undefined` = the browser default) and
// nothing reads the clock, matching the rest of the module.

import { formatDate } from "../format/datetime.ts";
import { parseDayKey, type DayKey } from "./grid.ts";

/** A `DayKey` as a local `Date` at midnight, or null when it isn't a real
 *  day. Calendar days are timezone-free, so the components are read back as
 *  *local* — the same day the user tapped, whatever their offset. */
export function dayKeyToDate(key: DayKey): Date | null {
  const parts = parseDayKey(key);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

/** The default shape: `"5 Jul"` / `"Jul 5"`, whichever the locale orders it
 *  as. The abbreviation is the form a chart tick and a list row can both
 *  carry, which is why it is the default rather than the long month. */
const DEFAULT_DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

/**
 * Render a `DayKey` for display. `options` passes through to
 * `Intl.DateTimeFormat`, so the same call covers the day-strip abbreviation
 * (`{ weekday: "short" }`), the unambiguous heading (`{ weekday: "short",
 * day: "numeric", month: "short", year: "numeric" }`) and anything else.
 *
 * A key that isn't a real day is returned unchanged rather than thrown on or
 * blanked: a label is not the place to discover a bad key, and the raw
 * `YYYY-MM-DD` is the most useful thing to show while finding out where it
 * came from.
 */
export function formatDayKey(
  key: DayKey,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const date = dayKeyToDate(key);
  return date ? formatDate(date, locale, options ?? DEFAULT_DAY_OPTIONS) : key;
}

/**
 * A month grid's own heading — `"July 2026"`, `"juli 2026"`, `"2026年7月"`.
 *
 * The long month name belongs here and largely only here: this string names a
 * *month* rather than a date, it sits alone at the top of the grid, and "Jul
 * 2026" over a calendar page reads as an abbreviation of nothing.
 *
 * Formatted as one date rather than assembled from `monthName` and the year,
 * because the two are not always in that order or joined by a space — a
 * locale that writes the year first would come out backwards from a template.
 * `month` is 1-based; one out of range falls back to just the year.
 */
export function formatMonthLabel(
  year: number,
  month: number,
  locale?: string,
): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return String(year);
  return formatDate(new Date(year, month - 1, 1), locale, {
    month: "long",
    year: "numeric",
  });
}
