<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `format` — pure string / value formatting helpers

Small pure formatters every app re-writes: tidy a user-typed URL, clump digit
runs, render a byte count, a number, a date, a "2 hours ago". Zero
dependencies, no DOM — everything here is a pure function over strings,
numbers and `Date`s, unit-testable in node.

- **`url.ts`** — `normalizeUrl` turns a user-typed website into an href (a
  bare `example.com` gets `https://`, an existing scheme is left alone, blank
  returns `""`); `displayUrl` is the reverse for display (scheme and trailing
  slash stripped).
- **`digits.ts`** — grouping primitives that express _how digits clump_, with
  no country or convention baked in: `digitsOnly`, `groupDigits`, and
  `groupPairsLeadingTriple` (pairs from the left, first group a triple when
  the count is odd — `"8181337"` → `"818 13 37"`). Your app's per-locale
  formatters compose their rules from these.
- **`bytes.ts`** — `formatBytes(bytes, locale?)` renders a compact
  human-readable size ("12 kB", "1.5 MB") in decimal (base-1000) steps, over
  **cached `Intl.NumberFormat` instances** (they are expensive to construct).
- **`number.ts`** — `formatNumber(value, locale?, options?)` (standard
  notation, options pass through to `Intl.NumberFormat`) and
  `formatCompact(value, locale?)` ("1.2K", "3.4M" — the axis-tick /
  stat-tile form). Charts' `formatValue` / `formatTick` props accept these
  directly.
- **`datetime.ts`** — `formatDate(date, locale?, options?)` (medium date
  style by default, any `Intl.DateTimeFormat` shape via `options`),
  `formatRelative(date, now, locale?)` ("2 hours ago", "yesterday", "in 3
  months" — `now` is a parameter, nothing reads the clock), and
  `formatDuration(ms, locale?, width?)` ("1 hr 23 min", "45 sec" — the
  largest unit plus its non-zero neighbour).
- **`names.ts`** — `weekdayNames(locale?, width?, weekStartsOn?)` (seven
  names rotated to start on the given day, Monday by default) and
  `monthName(month, locale?, width?)`. The header strings a month grid
  renders; the calendar module's components consume these.

```ts
import {
  normalizeUrl,
  displayUrl,
  digitsOnly,
  groupDigits,
  groupPairsLeadingTriple,
  formatBytes,
  formatNumber,
  formatCompact,
  formatDate,
  formatRelative,
  formatDuration,
  weekdayNames,
  monthName,
} from "@niclaslindstedt/oss-framework/format";
```

## Conventions (they bind later slices too)

- **Locale is always a parameter**, `undefined` = the browser default. The
  library carries no i18n of its own — an app passes its active locale in.
- **`Intl` instances are cached** per locale + options, module-internally.
- **Pure functions only** — no React, no DOM, no stored state beyond the
  formatter cache.

## Usage

```ts
normalizeUrl("example.com"); // "https://example.com"
displayUrl("https://example.com/"); // "example.com"
groupDigits("2025550100"); // "202 555 010 0"
groupPairsLeadingTriple("8181337"); // "818 13 37"
formatBytes(1_500_000); // "1.5 MB" (browser locale)
formatBytes(1_500_000, "sv-SE"); // "1,5 MB"

formatNumber(1234.5, "en-US"); // "1,234.5"
formatNumber(0.42, "en-US", { style: "percent" }); // "42%"
formatCompact(1_234, "en-US"); // "1.2K"

formatDate(new Date(2026, 6, 5), "en-US"); // "Jul 5, 2026"
formatDate(new Date(2026, 6, 5), "sv-SE", { dateStyle: "long" }); // "5 juli 2026"
formatRelative(twoHoursAgo, now, "en-US"); // "2 hours ago"
formatRelative(yesterday, now, "en-US"); // "yesterday"
formatDuration(4_980_000, "en-US"); // "1 hr 23 min"
formatDuration(4_980_000, "en-US", "narrow"); // "1h 23m"

weekdayNames("en-US"); // ["Mon", "Tue", …, "Sun"]
weekdayNames("en-US", "narrow", 0); // ["S", "M", …, "S"] (week starts Sunday)
monthName(7, "sv-SE"); // "juli"
```
