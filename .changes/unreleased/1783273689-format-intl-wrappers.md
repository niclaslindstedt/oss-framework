---
type: Added
title: Intl wrapper set in `format`
---

The `format` module now ships the full `Intl` wrapper set over cached
formatter instances: `formatNumber`, `formatCompact`, `formatDate`,
`formatRelative`, `formatDuration`, `weekdayNames` (rotated by week start),
and `monthName` — locale always a parameter, `undefined` = browser default.
