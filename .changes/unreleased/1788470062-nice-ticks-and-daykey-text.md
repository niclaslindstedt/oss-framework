---
type: Added
title: Tick decimals and DayKey rendering
---

`niceTicks` picks the densest 1/2/5 gridline scale that fits under a cap on
how many lines there may be, and reports the precision their labels should
print at; `formatDayKey` / `formatMonthLabel` / `dayKeyToDate` render a
`DayKey` as local midnight rather than letting `new Date(key)` shift it a day
west of Greenwich; `weekdayOrder` is `weekdayNames`' index-returning sibling.
