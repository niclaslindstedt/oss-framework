<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `format` — pure string / value formatting helpers

Small pure formatters every app re-writes: tidy a user-typed URL, clump digit
runs, render a byte count. Zero dependencies, no DOM — everything here is a
pure function over strings and numbers, unit-testable in node.

This is the **first slice** of the roadmap's `format` module
(`docs/expansion-roadmap.md` §4). The full `Intl` wrapper set —
`formatNumber`, `formatCompact`, `formatDate`, `formatRelative`,
`formatDuration`, `weekdayNames`, `monthName` — is still pending and lands in
later slices; this slice establishes the module and its conventions.

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

```ts
import {
  normalizeUrl,
  displayUrl,
  digitsOnly,
  groupDigits,
  groupPairsLeadingTriple,
  formatBytes,
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
```
