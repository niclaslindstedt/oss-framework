// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  dayKeyToDate,
  formatDayKey,
  formatMonthLabel,
} from "../src/calendar/index.ts";
import { weekdayOrder } from "../src/format/index.ts";

describe("dayKeyToDate", () => {
  it("reads a key back as LOCAL midnight, not UTC", () => {
    // The whole reason the helper exists: `new Date("2026-07-05")` is parsed
    // as UTC, so west of Greenwich it is the 4th locally. These assertions
    // hold in every zone.
    const date = dayKeyToDate("2026-07-05")!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(0);
  });

  it("rejects anything that isn't a real day", () => {
    expect(dayKeyToDate("2026-02-30")).toBeNull();
    expect(dayKeyToDate("not-a-day")).toBeNull();
    expect(dayKeyToDate("")).toBeNull();
  });
});

describe("formatDayKey", () => {
  it("defaults to the abbreviated day-and-month", () => {
    expect(formatDayKey("2026-07-05", undefined, "en-US")).toBe("Jul 5");
    expect(formatDayKey("2026-07-05", undefined, "en-GB")).toBe("5 Jul");
  });

  it("passes options through to Intl", () => {
    expect(
      formatDayKey(
        "2026-07-05",
        { weekday: "short", day: "numeric", month: "short", year: "numeric" },
        "en-GB",
      ),
    ).toBe("Sun, 5 Jul 2026");
    expect(formatDayKey("2026-07-05", { weekday: "short" }, "en-GB")).toBe(
      "Sun",
    );
  });

  it("hands an unreadable key straight back", () => {
    expect(formatDayKey("2026-13-01", undefined, "en-GB")).toBe("2026-13-01");
  });
});

describe("formatMonthLabel", () => {
  it("names the month in full, in the locale's own order", () => {
    expect(formatMonthLabel(2026, 7, "en-GB")).toBe("July 2026");
    expect(formatMonthLabel(2026, 7, "sv-SE")).toBe("juli 2026");
  });

  it("falls back to the bare year for a month out of range", () => {
    expect(formatMonthLabel(2026, 0, "en-GB")).toBe("2026");
    expect(formatMonthLabel(2026, 13, "en-GB")).toBe("2026");
  });
});

describe("weekdayOrder", () => {
  it("rotates the week to start where it is told", () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it("defaults to the ISO week, matching weekdayNames", () => {
    expect(weekdayOrder()).toEqual(weekdayOrder(1));
  });
});
