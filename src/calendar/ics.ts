// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// iCalendar (RFC 5545) serialization — the interchange half of the calendar
// module. An app that wants a date to live where the user already looks hands
// it off to the device calendar as a `.ics` file, which iOS Calendar, Google
// Calendar, and Outlook all import. This module renders that file: the
// VCALENDAR envelope, all-day VEVENTs, an optional yearly recurrence
// (`RRULE:FREQ=YEARLY` — e.g. an anniversary reminder), RFC 5545 text
// escaping, and 75-octet content-line folding.
//
// A pure renderer — no DOM, no I/O, no clock — so the whole surface is
// unit-testable in node. The caller supplies the already-translated summary
// (the module stays free of any i18n runtime), a stable UID (so a re-import
// updates the same entry instead of piling up duplicates), and `now` for the
// DTSTAMP. Download glue (Blob + anchor click) stays app-side.

import type { CalendarDate } from "./date-math.ts";

/** Escape a text value per RFC 5545 §3.3.11: backslash, semicolon, comma,
 *  newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets with a leading space on continuations, as
 *  RFC 5545 §3.1 prescribes. Folding on UTF-16 length is a close-enough proxy
 *  — importers accept shorter lines. */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    parts.push(` ${line.slice(i, i + 74)}`);
  }
  return parts.join("\r\n");
}

/** Two-digit zero-pad for the date/time fields. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYYMMDD` for an all-day DATE value. */
function icsDate(date: CalendarDate): string {
  return `${date.year}${pad(date.month)}${pad(date.day)}`;
}

/** `YYYYMMDDTHHMMSSZ` UTC stamp for DTSTAMP — the moment the file was made. */
function icsStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}T${pad(now.getUTCHours())}` +
    `${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/** One all-day entry in a calendar file. */
export interface IcsAllDayEvent {
  /** Stable identity across re-imports — a calendar updates the entry with
   *  the same UID rather than duplicating it. */
  uid: string;
  /** The (already translated) title shown in the calendar. */
  summary: string;
  /** The all-day date the entry starts on. */
  date: CalendarDate;
  /** Duration in whole days; defaults to 1 (a single-day entry). The DTEND an
   *  importer sees is exclusive — the day after the last covered day. */
  days?: number;
  /** `"yearly"` makes the entry recur every year on the same date
   *  (`RRULE:FREQ=YEARLY`). Omit for a one-off. */
  repeat?: "yearly";
  /** Whether the entry should mark the user as busy. Defaults to false —
   *  a reminder-style entry emits `TRANSP:TRANSPARENT`; pass true to leave
   *  transparency at the RFC's opaque default. */
  busy?: boolean;
}

/** Render one event as its unfolded VEVENT content lines. Exported so a
 *  caller composing a larger file can splice events into its own envelope;
 *  most callers want {@link buildIcsCalendar} instead. `now` stamps DTSTAMP. */
export function buildIcsEvent(event: IcsAllDayEvent, now: Date): string[] {
  const days = Math.max(1, Math.trunc(event.days ?? 1));
  // An all-day DTEND is exclusive, so the day after the last covered day
  // closes the entry. Built from fields so month/year boundaries roll over
  // correctly (Jan 31 + 1 day → Feb 1).
  const end = new Date(
    Date.UTC(event.date.year, event.date.month - 1, event.date.day + days),
  );
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
    `DTEND;VALUE=DATE:${icsDate({
      year: end.getUTCFullYear(),
      month: end.getUTCMonth() + 1,
      day: end.getUTCDate(),
    })}`,
    ...(event.repeat === "yearly" ? ["RRULE:FREQ=YEARLY"] : []),
    `SUMMARY:${escapeIcsText(event.summary)}`,
    ...(event.busy ? [] : ["TRANSP:TRANSPARENT"]),
    "END:VEVENT",
  ];
}

/** Options for {@link buildIcsCalendar}. */
export interface IcsCalendarOptions {
  /** The producer identifier, e.g. `-//myapp//reminders//EN`. */
  prodId: string;
  /** The entries to include, in file order. */
  events: IcsAllDayEvent[];
  /** The moment the file is made — stamps every event's DTSTAMP. */
  now: Date;
}

/** Render a complete importable `.ics` file: a VCALENDAR envelope around the
 *  given all-day events, every line folded at 75 octets and joined with the
 *  CRLF endings RFC 5545 requires (including a trailing CRLF). */
export function buildIcsCalendar(opts: IcsCalendarOptions): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId}`,
    "CALSCALE:GREGORIAN",
    ...opts.events.flatMap((event) => buildIcsEvent(event, opts.now)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
