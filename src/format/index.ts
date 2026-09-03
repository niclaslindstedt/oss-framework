// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public `format` surface: pure string / value formatting helpers — URL
// tidying (`url.ts`), digit-grouping primitives (`digits.ts`), and the
// `Intl` wrapper set over cached formatter instances: byte counts
// (`bytes.ts`), numbers (`number.ts`), dates / relative time / durations
// (`datetime.ts`), and weekday / month names (`names.ts`); plus two
// structured-text pairs — phone numbers (`phone.ts`) and postal addresses
// (`postal.ts`). Locale is always
// a parameter, `undefined` = the browser default — no i18n inside the
// library. See ./README.md.

export { normalizeUrl, displayUrl } from "./url.ts";
export { digitsOnly, groupDigits, groupPairsLeadingTriple } from "./digits.ts";
export { formatBytes } from "./bytes.ts";
export { formatNumber, formatCompact } from "./number.ts";
export {
  formatDate,
  formatRelative,
  formatDuration,
  type DurationWidth,
} from "./datetime.ts";
export {
  parsePhone,
  toStoredPhone,
  phoneDialString,
  extSuffix,
  type ParsedPhone,
} from "./phone.ts";
export {
  hasAddress,
  addressLines,
  formatAddress,
  mapsUrl,
  parseAddress,
  type AddressParts,
} from "./postal.ts";
export {
  weekdayNames,
  weekdayOrder,
  monthName,
  type NameWidth,
  type WeekdayIndex,
} from "./names.ts";
