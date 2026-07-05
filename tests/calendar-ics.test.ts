// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildIcsCalendar,
  buildIcsEvent,
  escapeIcsText,
  foldIcsLine,
  nextOccurrence,
  parseDateParts,
  type CalendarDate,
} from "../src/calendar/index.ts";

// A fixed "now" so the DTSTAMP is deterministic — 3 July 2026, 09:30:00 UTC.
const NOW = new Date(Date.UTC(2026, 6, 3, 9, 30, 0));

/** Render one yearly all-day entry from a stored date string, the way an app
 *  composes the pieces: parse, anchor a yearless value on its next
 *  occurrence, and wrap in a calendar. null when the string isn't a real
 *  date. */
function yearlyIcs(
  value: string,
  summary = "Ada Lovelace's day",
  uid = "entry-c1@app.example",
): string | null {
  const p = parseDateParts(value);
  if (!p) return null;
  const date: CalendarDate =
    p.year !== null
      ? { year: p.year, month: p.month, day: p.day }
      : nextOccurrence(value, NOW)!;
  return buildIcsCalendar({
    prodId: "-//app//reminder//EN",
    now: NOW,
    events: [{ uid, summary, date, repeat: "yearly" }],
  });
}

describe("buildIcsCalendar", () => {
  it("wraps a single all-day event in a VCALENDAR", () => {
    const out = yearlyIcs("1990-07-20") ?? "";
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out).toContain("VERSION:2.0");
    expect(out).toContain("PRODID:-//app//reminder//EN");
    expect(out).toContain("CALSCALE:GREGORIAN");
    expect(out).toContain("BEGIN:VEVENT");
    expect(out).toContain("END:VEVENT");
    // CRLF line endings, as RFC 5545 requires.
    expect(out.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(
      true,
    );
  });

  it("recurs every year when asked", () => {
    expect(yearlyIcs("1990-07-20")).toContain("RRULE:FREQ=YEARLY");
  });

  it("omits the RRULE for a one-off entry", () => {
    const out = buildIcsCalendar({
      prodId: "-//app//reminder//EN",
      now: NOW,
      events: [
        {
          uid: "u",
          summary: "One-off",
          date: { year: 2026, month: 8, day: 1 },
        },
      ],
    });
    expect(out).not.toContain("RRULE");
  });

  it("anchors the all-day event on the date, DTEND the next day", () => {
    const out = yearlyIcs("1990-07-20");
    expect(out).toContain("DTSTART;VALUE=DATE:19900720");
    expect(out).toContain("DTEND;VALUE=DATE:19900721");
  });

  it("rolls DTEND across a month boundary", () => {
    const out = yearlyIcs("1988-01-31");
    expect(out).toContain("DTSTART;VALUE=DATE:19880131");
    expect(out).toContain("DTEND;VALUE=DATE:19880201");
  });

  it("rolls DTEND across a year boundary", () => {
    const out = yearlyIcs("1999-12-31");
    expect(out).toContain("DTSTART;VALUE=DATE:19991231");
    expect(out).toContain("DTEND;VALUE=DATE:20000101");
  });

  it("keeps a 29 February on the 29th so it recurs in leap years", () => {
    const out = yearlyIcs("2000-02-29");
    expect(out).toContain("DTSTART;VALUE=DATE:20000229");
    expect(out).toContain("DTEND;VALUE=DATE:20000301");
  });

  it("stretches a multi-day entry via `days` (DTEND stays exclusive)", () => {
    const out = buildIcsCalendar({
      prodId: "-//app//reminder//EN",
      now: NOW,
      events: [
        {
          uid: "u",
          summary: "Long",
          date: { year: 2026, month: 8, day: 30 },
          days: 3,
        },
      ],
    });
    expect(out).toContain("DTSTART;VALUE=DATE:20260830");
    expect(out).toContain("DTEND;VALUE=DATE:20260902");
  });

  it("stamps the moment the file was made in UTC", () => {
    expect(yearlyIcs("1990-07-20")).toContain("DTSTAMP:20260703T093000Z");
  });

  it("carries a stable UID for update-not-duplicate re-imports", () => {
    expect(yearlyIcs("1990-07-20")).toContain("UID:entry-c1@app.example");
  });

  it("uses the supplied summary and escapes RFC 5545 specials", () => {
    const out = yearlyIcs("1990-07-20", "Ada, Countess; day");
    expect(out).toContain("SUMMARY:Ada\\, Countess\\; day");
  });

  it("marks entries transparent by default, opaque only when busy", () => {
    expect(yearlyIcs("1990-07-20")).toContain("TRANSP:TRANSPARENT");
    const busy = buildIcsCalendar({
      prodId: "-//app//reminder//EN",
      now: NOW,
      events: [
        {
          uid: "u",
          summary: "Busy",
          date: { year: 2026, month: 8, day: 1 },
          busy: true,
        },
      ],
    });
    expect(busy).not.toContain("TRANSP");
  });

  it("folds an over-long SUMMARY line and survives unfolding", () => {
    const summary = `Anniversary — ${"a very long name ".repeat(10)}end`;
    const out = yearlyIcs("2010-06-15", summary) ?? "";
    for (const line of out.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Unfolding (dropping CRLF + single leading space) restores the line.
    const unfolded = out.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${escapeIcsText(summary)}`);
  });

  it("carries several events in one envelope, in order", () => {
    const out = buildIcsCalendar({
      prodId: "-//app//reminder//EN",
      now: NOW,
      events: [
        { uid: "a", summary: "First", date: { year: 2026, month: 8, day: 1 } },
        { uid: "b", summary: "Second", date: { year: 2026, month: 9, day: 2 } },
      ],
    });
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(out.match(/END:VEVENT/g)).toHaveLength(2);
    expect(out.indexOf("SUMMARY:First")).toBeLessThan(
      out.indexOf("SUMMARY:Second"),
    );
    expect(out.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
  });

  it("is null when the stored string isn't a real date", () => {
    expect(yearlyIcs("2001-02-30")).toBeNull();
    expect(yearlyIcs("not-a-date")).toBeNull();
    expect(yearlyIcs("13-40")).toBeNull();
  });
});

describe("yearless anchoring (nextOccurrence + buildIcsCalendar)", () => {
  it("anchors a yearless date already passed this year on next year", () => {
    // 15 June is before 3 July (NOW), so the first reminder is next year.
    const out = yearlyIcs("06-15");
    expect(out).toContain("DTSTART;VALUE=DATE:20270615");
    expect(out).toContain("DTEND;VALUE=DATE:20270616");
    expect(out).toContain("RRULE:FREQ=YEARLY");
  });

  it("anchors a yearless date still ahead this year on this year", () => {
    const out = yearlyIcs("08-15");
    expect(out).toContain("DTSTART;VALUE=DATE:20260815");
    expect(out).toContain("DTEND;VALUE=DATE:20260816");
  });
});

describe("buildIcsEvent", () => {
  it("returns unfolded VEVENT content lines for composition", () => {
    const lines = buildIcsEvent(
      {
        uid: "u1",
        summary: "Standalone",
        date: { year: 2026, month: 7, day: 20 },
        repeat: "yearly",
      },
      NOW,
    );
    expect(lines[0]).toBe("BEGIN:VEVENT");
    expect(lines[lines.length - 1]).toBe("END:VEVENT");
    expect(lines).toContain("DTSTART;VALUE=DATE:20260720");
    expect(lines).toContain("RRULE:FREQ=YEARLY");
    expect(lines.every((l) => !l.includes("\r\n"))).toBe(true);
  });
});

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma, and newlines", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
    expect(escapeIcsText("a;b,c")).toBe("a\\;b\\,c");
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("leaves plain text alone", () => {
    expect(escapeIcsText("Ada Lovelace")).toBe("Ada Lovelace");
  });
});

describe("foldIcsLine", () => {
  it("leaves a 75-octet line unfolded", () => {
    const line = "X".repeat(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it("folds at 75 octets with space-prefixed 74-octet continuations", () => {
    const line = "X".repeat(200);
    const parts = foldIcsLine(line).split("\r\n");
    expect(parts[0]).toHaveLength(75);
    for (const cont of parts.slice(1)) {
      expect(cont.startsWith(" ")).toBe(true);
      expect(cont.length).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original octets.
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });
});
