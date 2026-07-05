// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekStrip,
  dayKeyOf,
  dayRange,
  daysBetween,
  extendRange,
  isInRange,
  isoWeek,
  parseDayKey,
  startOfWeek,
  toDayKey,
} from "../src/calendar/index.ts";

describe("DayKey round-trip", () => {
  it("renders and parses", () => {
    expect(toDayKey({ year: 2026, month: 7, day: 4 })).toBe("2026-07-04");
    expect(parseDayKey("2026-07-04")).toEqual({ year: 2026, month: 7, day: 4 });
  });

  it("rejects non-days", () => {
    expect(parseDayKey("2026-02-30")).toBeNull();
    expect(parseDayKey("2026-13-01")).toBeNull();
    expect(parseDayKey("2026-7-4")).toBeNull();
    expect(parseDayKey("nonsense")).toBeNull();
  });

  it("accepts 29 February only in leap years", () => {
    expect(parseDayKey("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(parseDayKey("2026-02-29")).toBeNull();
    // Century rule: 2000 leaps, 1900 didn't.
    expect(parseDayKey("2000-02-29")).not.toBeNull();
    expect(parseDayKey("1900-02-29")).toBeNull();
  });

  it("rolls out-of-range fields Gregorian-correctly in toDayKey", () => {
    expect(toDayKey({ year: 2026, month: 1, day: 32 })).toBe("2026-02-01");
  });

  it("reads a Date's local calendar day", () => {
    expect(dayKeyOf(new Date(2026, 6, 4, 23, 59))).toBe("2026-07-04");
  });

  it("compares chronologically as a string", () => {
    expect("2026-07-04" < "2026-07-10").toBe(true);
    expect("2026-09-30" < "2026-10-01").toBe(true);
    expect("2026-12-31" < "2027-01-01").toBe(true);
  });
});

describe("addDays / daysBetween", () => {
  it("steps across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("is DST-immune: exactly n calendar days across a transition", () => {
    // Europe/Stockholm springs forward 2026-03-29, falls back 2026-10-25;
    // US DST moves 2026-03-08 / 2026-11-01. Field arithmetic never sees it.
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });

  it("daysBetween is signed", () => {
    expect(daysBetween("2026-07-04", "2026-07-10")).toBe(6);
    expect(daysBetween("2026-07-10", "2026-07-04")).toBe(-6);
    expect(daysBetween("2026-07-04", "2026-07-04")).toBe(0);
  });
});

describe("addMonths", () => {
  it("keeps the day when it exists in the target month", () => {
    expect(addMonths("2026-07-04", 1)).toBe("2026-08-04");
    expect(addMonths("2026-07-04", -1)).toBe("2026-06-04");
  });

  it("clamps to the target month's end instead of rolling over", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-02-15", -3)).toBe("2025-11-15");
  });
});

describe("startOfWeek", () => {
  // 2026-07-04 is a Saturday.
  it("defaults to Monday (ISO-8601)", () => {
    expect(startOfWeek("2026-07-04")).toBe("2026-06-29");
    expect(startOfWeek("2026-06-29")).toBe("2026-06-29");
    expect(startOfWeek("2026-07-05")).toBe("2026-06-29"); // Sunday belongs to the Monday week
  });

  it("rotates to any week start", () => {
    expect(startOfWeek("2026-07-04", 0)).toBe("2026-06-28"); // Sunday start
    expect(startOfWeek("2026-07-04", 6)).toBe("2026-07-04"); // Saturday start: itself
  });
});

describe("isoWeek", () => {
  it("applies the Thursday rule at year boundaries", () => {
    // 2026-01-01 is a Thursday → week 1.
    expect(isoWeek("2026-01-01")).toBe(1);
    // 2027-01-01 is a Friday → still week 53 of 2026.
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2026-12-28")).toBe(53);
    // 2024-12-30 (Monday) belongs to 2025-W01.
    expect(isoWeek("2024-12-30")).toBe(1);
    expect(isoWeek("2024-12-29")).toBe(52); // the Sunday before stays in 2024
  });

  it("numbers a 53-week year", () => {
    // 2020 has 53 ISO weeks; 2020-12-31 is a Thursday.
    expect(isoWeek("2020-12-31")).toBe(53);
  });

  it("numbers mid-year days", () => {
    expect(isoWeek("2026-07-04")).toBe(27);
  });
});

describe("buildMonthGrid", () => {
  it("pads the first and last weeks with the adjacent months", () => {
    // July 2026: the 1st is a Wednesday.
    const weeks = buildMonthGrid(2026, 7);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.map((c) => c.key)).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
    expect(weeks[0]!.map((c) => c.inMonth)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    const last = weeks[4]!;
    expect(last[6]!.key).toBe("2026-08-02");
    expect(last[6]!.inMonth).toBe(false);
  });

  it("rotates with weekStartsOn", () => {
    const weeks = buildMonthGrid(2026, 7, { weekStartsOn: 0 });
    expect(weeks[0]![0]!.key).toBe("2026-06-28"); // Sunday
    expect(weeks[0]![3]!.key).toBe("2026-07-01");
  });

  it("spans four to six rows naturally, six with fixedWeeks", () => {
    // February 2027 starts on a Monday in a common year → exactly 4 rows.
    expect(buildMonthGrid(2027, 2)).toHaveLength(4);
    // August 2026 (Saturday the 1st, 31 days) needs 6 rows.
    expect(buildMonthGrid(2026, 8)).toHaveLength(6);
    expect(buildMonthGrid(2027, 2, { fixedWeeks: true })).toHaveLength(6);
    const padded = buildMonthGrid(2027, 2, { fixedWeeks: true });
    expect(padded[5]!.every((c) => !c.inMonth)).toBe(true);
  });

  it("flags the caller-supplied today", () => {
    const weeks = buildMonthGrid(2026, 7, { today: "2026-07-04" });
    const flat = weeks.flat();
    expect(flat.filter((c) => c.isToday).map((c) => c.key)).toEqual([
      "2026-07-04",
    ]);
    // Today outside the grid flags nothing.
    const other = buildMonthGrid(2026, 9, { today: "2026-07-04" }).flat();
    expect(other.some((c) => c.isToday)).toBe(false);
  });

  it("covers a leap February", () => {
    const flat = buildMonthGrid(2024, 2).flat();
    expect(flat.some((c) => c.key === "2024-02-29" && c.inMonth)).toBe(true);
  });
});

describe("buildWeekStrip", () => {
  it("returns the seven days around the anchor", () => {
    const strip = buildWeekStrip("2026-07-04", { today: "2026-07-04" });
    expect(strip.map((c) => c.key)).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
    expect(strip[0]!.inMonth).toBe(false); // June day, July anchor
    expect(strip[5]!.isToday).toBe(true);
  });
});

describe("day ranges", () => {
  it("normalizes order and tests inclusively", () => {
    const range = dayRange("2026-07-10", "2026-07-04");
    expect(range).toEqual({ start: "2026-07-04", end: "2026-07-10" });
    expect(isInRange("2026-07-04", range)).toBe(true);
    expect(isInRange("2026-07-10", range)).toBe(true);
    expect(isInRange("2026-07-07", range)).toBe(true);
    expect(isInRange("2026-07-11", range)).toBe(false);
  });

  it("extends to the smallest containing range", () => {
    expect(extendRange(null, "2026-07-04")).toEqual({
      start: "2026-07-04",
      end: "2026-07-04",
    });
    const range = { start: "2026-07-04", end: "2026-07-06" };
    expect(extendRange(range, "2026-07-10")).toEqual({
      start: "2026-07-04",
      end: "2026-07-10",
    });
    expect(extendRange(range, "2026-07-01")).toEqual({
      start: "2026-07-01",
      end: "2026-07-06",
    });
    expect(extendRange(range, "2026-07-05")).toBe(range);
  });
});
