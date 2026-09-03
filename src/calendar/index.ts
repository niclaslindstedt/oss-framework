// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public calendar surface. `date-math.ts` is the recurring-date core
// (year-optional parsing, years-since, next-occurrence); `ics.ts` renders
// importable iCalendar (RFC 5545) files; `grid.ts` / `range.ts` are the pure
// day-grid core (`DayKey` identity, month grids, ranges) under the
// `MonthGrid` / `MonthCalendar` / `DatePicker` components; `format.ts`
// renders a `DayKey` as local-midnight text, and `useDayPress.ts` adds the
// press-and-hold gesture a grid cell cannot offer from the inside.
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
export { dayKeyToDate, formatDayKey, formatMonthLabel } from "./format.ts";
export { MonthGrid, type MonthGridProps } from "./MonthGrid.tsx";
export {
  MonthCalendar,
  DEFAULT_MONTH_CALENDAR_LABELS,
  type MonthCalendarProps,
  type MonthCalendarLabels,
} from "./MonthCalendar.tsx";
export { useDayPress, type DayPressOptions } from "./useDayPress.ts";
export {
  DatePicker,
  DEFAULT_DATE_PICKER_LABELS,
  type DatePickerProps,
  type DatePickerLabels,
} from "./DatePicker.tsx";
