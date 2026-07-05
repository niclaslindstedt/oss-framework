// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public calendar surface. `date-math.ts` is the recurring-date core
// (year-optional parsing, years-since, next-occurrence); `ics.ts` renders
// importable iCalendar (RFC 5545) files; `grid.ts` / `range.ts` are the pure
// day-grid core (`DayKey` identity, month grids, ranges) under the
// `MonthGrid` and `DatePicker` components.
export {
  parseDateParts,
  yearsSince,
  nextOccurrence,
  daysUntilNextOccurrence,
  type CalendarDate,
  type DateParts,
} from "./date-math.ts";
export {
  escapeIcsText,
  foldIcsLine,
  buildIcsEvent,
  buildIcsCalendar,
  type IcsAllDayEvent,
  type IcsCalendarOptions,
} from "./ics.ts";
export {
  toDayKey,
  parseDayKey,
  dayKeyOf,
  addDays,
  addMonths,
  daysBetween,
  startOfWeek,
  isoWeek,
  buildMonthGrid,
  buildWeekStrip,
  type DayKey,
  type WeekStart,
  type GridCell,
  type MonthGridOptions,
} from "./grid.ts";
export { dayRange, isInRange, extendRange, type DayRange } from "./range.ts";
export { MonthGrid, type MonthGridProps } from "./MonthGrid.tsx";
export {
  DatePicker,
  DEFAULT_DATE_PICKER_LABELS,
  type DatePickerProps,
  type DatePickerLabels,
} from "./DatePicker.tsx";
