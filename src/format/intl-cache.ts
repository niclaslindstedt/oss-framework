// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Module-internal cache for `Intl` formatter instances — they are expensive
// to construct (locale data lookup + option resolution), and the formatters
// here are called per render in list rows and chart ticks. Keyed by locale +
// the option object's JSON; an `undefined` locale (the browser default) keys
// as the empty string, consistent with `bytes.ts`.

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

function cacheKey(locale: string | undefined, options: object): string {
  return `${locale ?? ""}|${JSON.stringify(options)}`;
}

export function numberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, formatter);
  }
  return formatter;
}

export function dateTimeFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = cacheKey(locale, options);
  let formatter = dateTimeFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateTimeFormats.set(key, formatter);
  }
  return formatter;
}

export function relativeTimeFormat(
  locale: string | undefined,
  options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  const key = cacheKey(locale, options);
  let formatter = relativeTimeFormats.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, options);
    relativeTimeFormats.set(key, formatter);
  }
  return formatter;
}
