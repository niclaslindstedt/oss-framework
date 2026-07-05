---
type: Added
title: Calendar grid + DatePicker
---

The `calendar` module now ships its UI half: a pure day-grid core (`DayKey`
identity, `addDays`/`addMonths` end-of-month clamped, `startOfWeek`,
`isoWeek`, `buildMonthGrid`, `buildWeekStrip`, day ranges) plus the
`MonthGrid` component (ARIA grid pattern, roving tabindex, `renderDay`
marker seam, min/max/disabled days) and a `DatePicker` field built on it.
