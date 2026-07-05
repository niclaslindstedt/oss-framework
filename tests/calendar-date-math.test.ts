// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  daysUntilNextOccurrence,
  nextOccurrence,
  parseDateParts,
  yearsSince,
} from "../src/calendar/index.ts";

// A fixed "now" so the maths is deterministic — noon on 3 July 2026.
const NOW = new Date(2026, 6, 3, 12, 0, 0);

describe("parseDateParts", () => {
  it("parses a full ISO date", () => {
    expect(parseDateParts("2010-06-15")).toEqual({
      year: 2010,
      month: 6,
      day: 15,
    });
  });

  it("parses a yearless month-day", () => {
    expect(parseDateParts("06-15")).toEqual({ year: null, month: 6, day: 15 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseDateParts(" 2010-06-15 ")).toEqual({
      year: 2010,
      month: 6,
      day: 15,
    });
  });

  it("accepts 29 February — dated and yearless", () => {
    expect(parseDateParts("2000-02-29")).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
    expect(parseDateParts("02-29")).toEqual({ year: null, month: 2, day: 29 });
  });

  it("rejects impossible days", () => {
    expect(parseDateParts("2001-02-30")).toBeNull();
    expect(parseDateParts("2001-02-29")).toBeNull(); // 2001 is no leap year
    expect(parseDateParts("13-40")).toBeNull();
    expect(parseDateParts("02-30")).toBeNull();
  });

  it("rejects strings that aren't dates at all", () => {
    expect(parseDateParts("not-a-date")).toBeNull();
    expect(parseDateParts("13/02/1990")).toBeNull();
    expect(parseDateParts("")).toBeNull();
  });
});

describe("yearsSince", () => {
  it("counts whole years, before the date this year", () => {
    // Recurs later in July → this year's not yet reached.
    expect(yearsSince("1990-07-20", NOW)).toBe(35);
  });

  it("counts the extra year once the date has passed", () => {
    expect(yearsSince("1990-06-20", NOW)).toBe(36);
  });

  it("counts the day itself as a completed year", () => {
    expect(yearsSince("1990-07-03", NOW)).toBe(36);
  });

  it("is null for an invalid or future date", () => {
    expect(yearsSince("not-a-date", NOW)).toBeNull();
    expect(yearsSince("2001-02-30", NOW)).toBeNull();
    expect(yearsSince("2030-01-01", NOW)).toBeNull();
  });

  it("is null for a yearless date — nothing has elapsed", () => {
    expect(yearsSince("06-15", NOW)).toBeNull();
  });
});

describe("daysUntilNextOccurrence", () => {
  it("is 0 on the day itself", () => {
    expect(daysUntilNextOccurrence("1990-07-03", NOW)).toBe(0);
  });

  it("is 1 the day before", () => {
    expect(daysUntilNextOccurrence("1990-07-04", NOW)).toBe(1);
  });

  it("counts forward to next year once this year's date has passed", () => {
    // 2 July already gone → next is 2 July 2027, 364 days out.
    expect(daysUntilNextOccurrence("1990-07-02", NOW)).toBe(364);
  });

  it("counts a date later this year", () => {
    expect(daysUntilNextOccurrence("1990-07-20", NOW)).toBe(17);
  });

  it("treats a yearless date the same as a dated one", () => {
    expect(daysUntilNextOccurrence("07-20", NOW)).toBe(17);
    expect(daysUntilNextOccurrence("07-02", NOW)).toBe(364);
  });

  it("rolls a 29 February onto 1 March in common years", () => {
    // 2026 is a common year; from 28 Feb the occurrence lands on 1 Mar.
    const feb28 = new Date(2026, 1, 28, 12, 0, 0);
    expect(daysUntilNextOccurrence("02-29", feb28)).toBe(1);
  });

  it("keeps a 29 February on the 29th in leap years", () => {
    const feb28leap = new Date(2028, 1, 28, 12, 0, 0);
    expect(daysUntilNextOccurrence("02-29", feb28leap)).toBe(1);
    expect(nextOccurrence("02-29", feb28leap)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it("is null for an unparseable date", () => {
    expect(daysUntilNextOccurrence("13/02/1990", NOW)).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("anchors a date already passed this year on next year", () => {
    // 15 June is before 3 July (NOW), so the next occurrence is next year.
    expect(nextOccurrence("06-15", NOW)).toEqual({
      year: 2027,
      month: 6,
      day: 15,
    });
  });

  it("anchors a date still ahead this year on this year", () => {
    expect(nextOccurrence("08-15", NOW)).toEqual({
      year: 2026,
      month: 8,
      day: 15,
    });
  });

  it("is today on the day itself", () => {
    expect(nextOccurrence("07-03", NOW)).toEqual({
      year: 2026,
      month: 7,
      day: 3,
    });
  });

  it("ignores a dated value's own year — occurrences look forward", () => {
    expect(nextOccurrence("2010-06-15", NOW)).toEqual({
      year: 2027,
      month: 6,
      day: 15,
    });
  });

  it("rolls a 29 February onto 1 March in common years", () => {
    expect(nextOccurrence("02-29", NOW)).toEqual({
      year: 2027,
      month: 3,
      day: 1,
    });
  });

  it("is null for a date that isn't real", () => {
    expect(nextOccurrence("13-40", NOW)).toBeNull();
  });
});
