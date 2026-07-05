// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Human-readable byte counts over cached `Intl.NumberFormat` instances (they
// are expensive to construct). The number is localized — digits, decimal
// separator, sign — while the unit stays the invariant SI symbol ("kB", "MB"),
// which `Intl`'s own unit display renders inconsistently across magnitudes.
// Locale is always a parameter; `undefined` means the browser default — no
// i18n inside the library.

/** Decimal (SI, base-1000) byte units. */
const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"] as const;

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(
  locale: string | undefined,
  maxFractionDigits: number,
): Intl.NumberFormat {
  const key = `${locale ?? ""}|${maxFractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxFractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Render a byte count as a compact human-readable size ("0 B", "12 kB",
 *  "1.5 MB"), scaling in decimal (base-1000) steps. One fraction digit is kept
 *  while the scaled value is below 10 ("1.5 MB"), none above ("12 kB", "128
 *  MB") — and never on plain bytes. `locale` shapes the number (decimal
 *  separator, digits); `undefined` uses the browser default. A non-finite
 *  input returns an empty string. */
export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes)) return "";
  const sign = bytes < 0 ? -1 : 1;
  let value = Math.abs(bytes);
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const maxFractionDigits = unit > 0 && value < 10 ? 1 : 0;
  const number = formatterFor(locale, maxFractionDigits).format(sign * value);
  return `${number} ${BYTE_UNITS[unit]}`;
}
