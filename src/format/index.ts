// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public `format` surface: pure string / value formatting helpers. This is the
// first slice of the roadmap's `format` module — URL tidying (`url.ts`),
// digit-grouping primitives (`digits.ts`), and byte counts over cached
// `Intl.NumberFormat` instances (`bytes.ts`). The rest of the `Intl` wrapper
// set (numbers, dates, relative time, durations, weekday / month names) lands
// in later slices. See ./README.md.

export { normalizeUrl, displayUrl } from "./url.ts";
export { digitsOnly, groupDigits, groupPairsLeadingTriple } from "./digits.ts";
export { formatBytes } from "./bytes.ts";
