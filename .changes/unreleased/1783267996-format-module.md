---
type: Added
title: Format
---

New `format` module (first slice of the roadmap's `Intl` wrappers): URL
tidying (`normalizeUrl` / `displayUrl`), digit-grouping primitives
(`digitsOnly`, `groupDigits`, `groupPairsLeadingTriple`), and
`formatBytes(bytes, locale?)` over cached `Intl.NumberFormat` instances.
