// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public calendar surface — slice 1: file serialization + pure date math.
// `ics.ts` renders importable iCalendar (RFC 5545) files; `date-math.ts` is
// the DOM-free recurring-date core (year-optional parsing, years-since,
// next-occurrence). The grid/picker components from the expansion roadmap
// (`MonthGrid`, `DatePicker`, `buildMonthGrid`, …) are a later slice.
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
