// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Localized number rendering over cached `Intl.NumberFormat` instances.
// Locale is always a parameter; `undefined` means the browser default — no
// i18n inside the library. Charts' `formatValue` / `formatTick` props accept
// these directly: `(v) => formatCompact(v, locale)`.

import { numberFormat } from "./intl-cache.ts";

const EMPTY_OPTIONS: Intl.NumberFormatOptions = {};

/** Render a number in the locale's standard notation ("1,234.5" /
 *  "1 234,5"). `options` passes through to `Intl.NumberFormat` (fraction
 *  digits, percent style, …); instances are cached per locale + options. A
 *  non-finite input returns an empty string. */
export function formatNumber(
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return "";
  return numberFormat(locale, options ?? EMPTY_OPTIONS).format(value);
}

const COMPACT_OPTIONS: Intl.NumberFormatOptions = {
  notation: "compact",
  maximumFractionDigits: 1,
};

/** Render a number in the locale's compact notation ("1.2K", "3.4M" —
 *  "1,2 tn" in Swedish), keeping at most one fraction digit. The dashboard /
 *  axis-tick form of {@link formatNumber}. A non-finite input returns an
 *  empty string. */
export function formatCompact(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return "";
  return numberFormat(locale, COMPACT_OPTIONS).format(value);
}
