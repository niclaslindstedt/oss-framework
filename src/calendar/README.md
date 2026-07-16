<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `calendar` — date math, iCalendar files, month grid + date picker

Date _math_ is the mechanism; "event", "appointment", "due date" are app
words and stay out. The module has a pure, DOM-free core with two components
layered on top:

- **`date-math.ts`** — parse a year-optional stored date and do calendar-field
  arithmetic over it. No millisecond arithmetic across DST; `now` is always a
  parameter, so everything is deterministic under test.
- **`ics.ts`** — render an importable iCalendar (RFC 5545) file: VCALENDAR
  envelope, all-day VEVENTs, optional yearly recurrence, text escaping, and
  75-octet line folding. iOS Calendar, Google Calendar, and Outlook all
  import the output.
- **`grid.ts`** — day identity as a `DayKey` (`"2026-07-04"` —
  serialization-safe, compares chronologically as a string) and the grid
  math over it: `addDays`, `addMonths` (end-of-month clamped), `startOfWeek`,
  `isoWeek` (ISO-8601 Thursday rule), `daysBetween`, `buildMonthGrid(year,
month, { weekStartsOn, fixedWeeks, today })` → `GridCell[][]`,
  `buildWeekStrip`. All arithmetic runs on the UTC day line, so DST can't
  shear a row; nothing reads the clock.
- **`range.ts`** — inclusive `DayRange` over `DayKey`s: `dayRange`,
  `isInRange`, `extendRange` (plain string comparison, no `Date`s).
- **`MonthGrid.tsx`** — the WAI-ARIA grid pattern over the framework's
  `useGridRovingTabindex`: one Tab stop, arrows walk days, Home/End jump,
  PageUp/PageDown page the month via `onMonthNav`. Weekday headers and
  spoken day names come from the `format` module's locale wrappers.
  `renderDay` is the app's marker seam; `min`/`max`/`isDisabled` gate days
  (disabled days stay focusable, per the pattern). `autoFocus` (off by
  default) seats keyboard focus for popover use.
- **`DatePicker.tsx`** — a bordered trigger field floating a month grid via
  `FloatingPanel`: month paging header, optional clear row, focus return on
  commit. The header caption is a button that zooms out to a month grid, and
  the year there zooms out again to a twelve-year page — the quick month/year
  jump a native control gives, so a far-off date is a couple of taps rather
  than a long paging drag (and, being ordinary in-panel interaction, it
  survives an iOS PWA where a native `<input type="date">` dismisses its own
  popover on a month change). `min`/`max` gate whole months and years the way
  they gate days. Labels inject with English defaults
  (`DEFAULT_DATE_PICKER_LABELS`); the trigger renders the value through
  `formatDate` unless `formatValue` overrides it.

```ts
import {
  parseDateParts,
  yearsSince,
  nextOccurrence,
  daysUntilNextOccurrence,
  buildIcsCalendar,
  buildIcsEvent,
  escapeIcsText,
  foldIcsLine,
  type CalendarDate,
  type DateParts,
  type IcsAllDayEvent,
  type IcsCalendarOptions,
} from "@niclaslindstedt/oss-framework/calendar";
```

## Date math

A stored date is a plain string that may or may not know its year: a full ISO
`YYYY-MM-DD`, or a bare `MM-DD` when only the month and day matter.

```ts
parseDateParts("2010-06-15"); // { year: 2010, month: 6, day: 15 }
parseDateParts("06-15"); // { year: null, month: 6, day: 15 }
parseDateParts("2001-02-30"); // null — not a real day

const now = new Date(); // the caller owns the clock

yearsSince("2010-06-15", now); // whole years elapsed; the day itself counts
yearsSince("06-15", now); // null — no year, nothing has elapsed

nextOccurrence("06-15", now); // next yearly occurrence as a CalendarDate
daysUntilNextOccurrence("06-15", now); // 0 on the day, 1 the day before, …
```

Behavioural guarantees:

- **Every function takes `now`** — nothing reads the clock, so results are
  deterministic and unit-testable.
- **Calendar-field arithmetic only.** Day counts run on fields projected onto
  the UTC day line, never on local-time millisecond differences, so a DST
  transition between now and the next occurrence can't shear a count.
- **29 February** parses (it's a real day), and its yearly occurrence rolls
  onto 1 March in common years.
- Invalid input returns `null`, never throws.

## iCalendar files

`buildIcsCalendar` renders a complete importable `.ics` string; the app owns
the download glue (Blob + anchor click) and the translated strings.

```ts
const parts = parseDateParts(stored); // null → nothing to export
if (parts) {
  const date: CalendarDate =
    parts.year !== null
      ? { year: parts.year, month: parts.month, day: parts.day }
      : nextOccurrence(stored, now)!; // anchor a yearless date on its next occurrence

  const ics = buildIcsCalendar({
    prodId: "-//myapp//reminders//EN",
    now,
    events: [
      {
        uid: `reminder-${id}@myapp.example`, // stable → re-import updates, not duplicates
        summary: t("reminder.title", name), // already translated
        date,
        repeat: "yearly", // omit for a one-off
      },
    ],
  });
}
```

Each event is an all-day entry: `DTSTART;VALUE=DATE` on the given date and an
exclusive `DTEND` the day after (`days` stretches the duration). `repeat:
"yearly"` emits `RRULE:FREQ=YEARLY`. Entries default to `TRANSP:TRANSPARENT`
(a reminder shouldn't mark anyone busy); pass `busy: true` to keep the RFC's
opaque default. `buildIcsEvent` returns one event's unfolded content lines for
callers composing a larger file, and `escapeIcsText` / `foldIcsLine` expose
the RFC 5545 text rules on their own.

## The grid and the components

```tsx
import {
  buildMonthGrid,
  MonthGrid,
  DatePicker,
  type DayKey,
} from "@niclaslindstedt/oss-framework/calendar";

// Pure: five-to-six week rows of { key, day, inMonth, isToday } cells.
const weeks = buildMonthGrid(2026, 7, { weekStartsOn: 1, today: "2026-07-04" });

// The app owns what a day means: markers via renderDay, vetoes via
// isDisabled, and whatever onSelect does with the picked DayKey.
<MonthGrid
  year={2026}
  month={7}
  selected={selectedDay}
  onSelect={setSelectedDay}
  today={todayKey}
  locale="sv-SE"
  renderDay={(cell) => (hasEntries(cell.key) ? <Dot /> : null)}
/>;

<DatePicker
  value={due} // DayKey | null — what you store is what you get
  onChange={setDue}
  min={todayKey}
  locale={locale}
  clearable
  labels={{ placeholder: t("pickDay") }}
/>;
```

## What it owns vs. what stays in your app

| In the framework                                   | In your app                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| parsing, years-since, next-occurrence, day counts  | what the dates mean (whose day, which reminder)      |
| the `.ics` envelope, escaping, folding, recurrence | UIDs, translated summaries, the download/share glue  |
| grid math, keyboard/ARIA wiring, popover plumbing  | day markers, blackout rules, item storage per day    |
| `null` for invalid input                           | deciding what to show when a stored value is invalid |

Recurrence is deliberately out (full RFC 5545 is a library in itself — the
`.ics` half emits `RRULE:FREQ=YEARLY` and stops there), and so is an agenda
view: `DayKey → items[]` plus `renderDay` is the whole seam an agenda needs.

## Verification

- `npx vitest run tests/calendar-date-math.test.ts tests/calendar-ics.test.ts
tests/calendar-grid.test.ts tests/calendar-components.test.tsx`
- Import a generated file into a real calendar app and confirm one all-day
  entry appears on the right date, recurs yearly, and a re-import with the
  same UID updates it in place.
- The demo's Statistics dialog drives both components against live data
  (`demo/src/app/StatsModal.tsx`).
