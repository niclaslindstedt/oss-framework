// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Localized weekday / month names over cached `Intl.DateTimeFormat`
// instances — the header strings a month grid or a date field needs, without
// the app shipping its own name tables. Names are read off known reference
// dates pinned to UTC so the host machine's time zone can never shift a
// label. Locale is always a parameter; `undefined` = the browser default.

import { dateTimeFormat } from "./intl-cache.ts";

/** How wide a name renders: `"long"` ("Monday" / "January"), `"short"`
 *  ("Mon" / "Jan"), `"narrow"` ("M" / "J"). */
export type NameWidth = "long" | "short" | "narrow";

/** Day-of-week index in `Date.getDay()`'s numbering: 0 = Sunday … 6 =
 *  Saturday. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// 2021-08-01 fell on a Sunday, so UTC day (1 + getDay-index) of that month
// names each weekday.
const SUNDAY_UTC = Date.UTC(2021, 7, 1);
const DAY_MS = 86_400_000;

/** The locale's seven weekday names, starting at `weekStartsOn` (0 = Sunday
 *  … 6 = Saturday in `Date.getDay()`'s numbering; defaults to 1, Monday —
 *  the ISO-8601 week) so the result maps 1:1 onto a week row's columns.
 *  `weekdayNames("sv-SE", "short")` → `["mån", "tis", …, "sön"]`. */
export function weekdayNames(
  locale?: string,
  width: NameWidth = "short",
  weekStartsOn: WeekdayIndex = 1,
): string[] {
  const formatter = dateTimeFormat(locale, {
    weekday: width,
    timeZone: "UTC",
  });
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = (weekStartsOn + i) % 7;
    names.push(formatter.format(new Date(SUNDAY_UTC + day * DAY_MS)));
  }
  return names;
}

/** The seven weekday *indices* in the order a week starting on
 *  `weekStartsOn` runs — `weekdayNames`' sibling, for the callers that need
 *  the numbering rather than the labels. A row of day toggles and the month
 *  grid above it both lay out on this, so neither has to re-derive the
 *  rotation and get it a day out. `weekdayOrder(0)` → `[0, 1, …, 6]`;
 *  `weekdayOrder(1)` → `[1, 2, …, 6, 0]`. */
export function weekdayOrder(weekStartsOn: WeekdayIndex = 1): WeekdayIndex[] {
  return Array.from(
    { length: 7 },
    (_, i) => ((weekStartsOn + i) % 7) as WeekdayIndex,
  );
}

/** The locale's name for a month (1-based: 1 = January … 12 = December).
 *  `monthName(7, "sv-SE")` → `"juli"`. Out-of-range months return an empty
 *  string. */
export function monthName(
  month: number,
  locale?: string,
  width: NameWidth = "long",
): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return "";
  const formatter = dateTimeFormat(locale, { month: width, timeZone: "UTC" });
  return formatter.format(new Date(Date.UTC(2021, month - 1, 1)));
}
