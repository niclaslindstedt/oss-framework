// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Localized date / relative-time / duration rendering over cached `Intl`
// instances. Locale is always a parameter (`undefined` = browser default),
// and nothing here reads the clock — `formatRelative` takes the reference
// `now` explicitly, matching the calendar module's convention, so every
// function is deterministic under test.

import {
  dateTimeFormat,
  numberFormat,
  relativeTimeFormat,
} from "./intl-cache.ts";

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

/** Render a `Date` for display ("Jul 5, 2026" / "5 juli 2026"). Defaults to
 *  the locale's medium date style; `options` passes through to
 *  `Intl.DateTimeFormat` to pick any other shape (time included, weekday,
 *  numeric month, …). An invalid date returns an empty string. */
export function formatDate(
  date: Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormat(locale, options ?? DEFAULT_DATE_OPTIONS).format(date);
}

// Unit ladder for `formatRelative`: pick the largest unit whose span the
// delta fills at least once, with months/years on civil-average lengths (a
// relative phrase is an approximation by design — calendar-exact day math
// lives in the calendar module).
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30.44 * DAY_MS;
const YEAR_MS = 365.25 * DAY_MS;

type RelativeStep = {
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
  limit: number;
};

const YEAR_STEP: RelativeStep = {
  unit: "year",
  ms: YEAR_MS,
  limit: Number.POSITIVE_INFINITY,
};

const RELATIVE_LADDER: readonly RelativeStep[] = [
  { unit: "second", ms: SECOND_MS, limit: MINUTE_MS },
  { unit: "minute", ms: MINUTE_MS, limit: HOUR_MS },
  { unit: "hour", ms: HOUR_MS, limit: DAY_MS },
  { unit: "day", ms: DAY_MS, limit: MONTH_MS },
  { unit: "month", ms: MONTH_MS, limit: YEAR_MS },
  YEAR_STEP,
];

/** Render how far `date` lies from `now` ("2 hours ago", "yesterday", "in 3
 *  months"), choosing the largest sensible unit and letting the locale speak
 *  idioms (`numeric: "auto"` — "yesterday" over "1 day ago"). The caller owns
 *  the clock: pass `now` explicitly. An invalid date returns an empty
 *  string. */
export function formatRelative(date: Date, now: Date, locale?: string): string {
  const time = date.getTime();
  if (Number.isNaN(time) || Number.isNaN(now.getTime())) return "";
  const delta = time - now.getTime();
  const magnitude = Math.abs(delta);
  const step = RELATIVE_LADDER.find((s) => magnitude < s.limit) ?? YEAR_STEP;
  const value = Math.round(delta / step.ms);
  return relativeTimeFormat(locale, { numeric: "auto" }).format(
    // Round toward the phrase the user expects: -0 reads as "now", keep it 0.
    value === 0 ? 0 : value,
    step.unit,
  );
}

const DURATION_UNITS: readonly { unit: string; ms: number }[] = [
  { unit: "day", ms: DAY_MS },
  { unit: "hour", ms: HOUR_MS },
  { unit: "minute", ms: MINUTE_MS },
  { unit: "second", ms: SECOND_MS },
];

/** How wide a duration's unit labels render: `"short"` ("1 hr 23 min"),
 *  `"narrow"` ("1h 23m"), `"long"` ("1 hour 23 minutes"). */
export type DurationWidth = "long" | "short" | "narrow";

/** Render a span of milliseconds as its largest unit plus, when non-zero,
 *  the unit right below it ("1 hr 23 min", "45 sec", "2 days 3 hr" — but "1
 *  hr", not "1 hr 30 sec", when the minutes are zero), each localized
 *  through `Intl.NumberFormat`'s unit style. Sub-second spans render "0
 *  sec". A negative span formats its absolute value; a non-finite one
 *  returns an empty string. Built on plain `NumberFormat` units — not the
 *  still-uneven `Intl.DurationFormat` — so it runs everywhere the library
 *  does. */
export function formatDuration(
  ms: number,
  locale?: string,
  width: DurationWidth = "short",
): string {
  if (!Number.isFinite(ms)) return "";
  const magnitude = Math.abs(ms);
  const render = (count: number, unit: string) =>
    numberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: width,
    }).format(count);

  const first = DURATION_UNITS.findIndex(
    ({ ms: unitMs }) => magnitude >= unitMs,
  );
  const head = first === -1 ? undefined : DURATION_UNITS[first];
  if (!head) return render(0, "second");
  const headCount = Math.floor(magnitude / head.ms);
  const next = DURATION_UNITS[first + 1];
  const nextCount = next
    ? Math.floor((magnitude - headCount * head.ms) / next.ms)
    : 0;
  const parts = [render(headCount, head.unit)];
  if (next && nextCount > 0) parts.push(render(nextCount, next.unit));
  return parts.join(" ");
}
