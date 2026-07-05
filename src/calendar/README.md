<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `calendar` — recurring-date math and iCalendar serialization

**This is slice 1 of the calendar module**: pure date math plus `.ics` file
serialization, DOM-free and dependency-free. The UI half planned in the
[expansion roadmap](../../docs/expansion-roadmap.md#5--calendar--calendar-ml-high)
— `buildMonthGrid`, the `MonthGrid` component, and the `DatePicker` — is
**still pending** and lands in a later slice.

Local-first apps accumulate notable yearly dates — an anniversary, a name
day, a renewal — and want two things from them: at-a-glance math ("in how
many days?", "how many years now?") and a hand-off to the device calendar the
user already looks at. This slice is those two things, as pure functions:

- **`date-math.ts`** — parse a year-optional stored date and do calendar-field
  arithmetic over it. No millisecond arithmetic across DST; `now` is always a
  parameter, so everything is deterministic under test.
- **`ics.ts`** — render an importable iCalendar (RFC 5545) file: VCALENDAR
  envelope, all-day VEVENTs, optional yearly recurrence, text escaping, and
  75-octet line folding. iOS Calendar, Google Calendar, and Outlook all
  import the output.

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

## What it owns vs. what stays in your app

| In the framework                                   | In your app                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| parsing, years-since, next-occurrence, day counts  | what the dates mean (whose day, which reminder)      |
| the `.ics` envelope, escaping, folding, recurrence | UIDs, translated summaries, the download/share glue  |
| `null` for invalid input                           | deciding what to show when a stored value is invalid |

## Verification

- `npx vitest run tests/calendar-date-math.test.ts tests/calendar-ics.test.ts`
- Import a generated file into a real calendar app and confirm one all-day
  entry appears on the right date, recurs yearly, and a re-import with the
  same UID updates it in place.
