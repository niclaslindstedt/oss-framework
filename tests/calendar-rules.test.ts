// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  addToMonthDay,
  easterSunday,
  lastWeekdayOfMonth,
  nthWeekdayOfMonth,
  weekdayOfMonthDay,
  weekdayOnOrAfter,
} from "../src/calendar/rules.ts";

const MONDAY = 1;
const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 0;

describe("easterSunday", () => {
  // Spot values from the published Gregorian Easter tables, chosen to cover
  // both months, a century boundary, and the extreme early / late dates.
  it.each([
    [2000, 4, 23],
    [2018, 4, 1],
    [2019, 4, 21],
    [2020, 4, 12],
    [2021, 4, 4],
    [2022, 4, 17],
    [2023, 4, 9],
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2030, 4, 21],
    [2038, 4, 25],
    [2049, 4, 18],
    [2100, 3, 28],
  ])("puts %i's Easter on %i-%i", (year, month, day) => {
    expect(easterSunday(year)).toEqual({ month, day });
  });

  it("never lands outside 22 March – 25 April", () => {
    for (let year = 1900; year <= 2200; year += 1) {
      const { month, day } = easterSunday(year);
      const ordinal = month === 3 ? day : 31 + day;
      expect(ordinal).toBeGreaterThanOrEqual(22);
      expect(ordinal).toBeLessThanOrEqual(31 + 25);
    }
  });

  it("always falls on a Sunday", () => {
    for (let year = 1900; year <= 2200; year += 1) {
      const { month, day } = easterSunday(year);
      expect(weekdayOfMonthDay(year, month, day)).toBe(SUNDAY);
    }
  });
});

describe("addToMonthDay", () => {
  it("walks forward and backward across a month boundary", () => {
    expect(addToMonthDay(2025, 4, 20, -2)).toEqual({ month: 4, day: 18 });
    expect(addToMonthDay(2025, 4, 20, 39)).toEqual({ month: 5, day: 29 });
    expect(addToMonthDay(2025, 3, 1, -1)).toEqual({ month: 2, day: 28 });
  });

  it("knows a leap year", () => {
    expect(addToMonthDay(2024, 3, 1, -1)).toEqual({ month: 2, day: 29 });
  });

  it("reports the day it lands on when the offset leaves the year", () => {
    expect(addToMonthDay(2025, 12, 31, 1)).toEqual({ month: 1, day: 1 });
    expect(addToMonthDay(2025, 1, 1, -1)).toEqual({ month: 12, day: 31 });
  });

  it("is unmoved by the host time zone", () => {
    // Built at UTC noon, so no offset on earth can shear the day.
    expect(addToMonthDay(2025, 6, 15, 0)).toEqual({ month: 6, day: 15 });
  });
});

describe("weekdayOnOrAfter", () => {
  it("returns the day itself when it is already that weekday", () => {
    // 21 June 2025 is a Saturday.
    expect(weekdayOnOrAfter(2025, 6, 21, SATURDAY)).toEqual({
      month: 6,
      day: 21,
    });
  });

  it("resolves a 'between the 20th and the 26th' rule", () => {
    // Midsummer's Day: the Saturday falling 20–26 June.
    expect(weekdayOnOrAfter(2025, 6, 20, SATURDAY)).toEqual({
      month: 6,
      day: 21,
    });
    expect(weekdayOnOrAfter(2026, 6, 20, SATURDAY)).toEqual({
      month: 6,
      day: 20,
    });
  });

  it("crosses into the next month when it has to", () => {
    expect(weekdayOnOrAfter(2025, 5, 30, MONDAY)).toEqual({
      month: 6,
      day: 2,
    });
  });
});

describe("nthWeekdayOfMonth", () => {
  it("finds the first Monday of May", () => {
    expect(nthWeekdayOfMonth(2025, 5, MONDAY, 1)).toEqual({
      month: 5,
      day: 5,
    });
    expect(nthWeekdayOfMonth(2026, 5, MONDAY, 1)).toEqual({
      month: 5,
      day: 4,
    });
  });

  it("counts on from there", () => {
    expect(nthWeekdayOfMonth(2025, 5, MONDAY, 2)).toEqual({
      month: 5,
      day: 12,
    });
    expect(nthWeekdayOfMonth(2025, 11, FRIDAY, 4)).toEqual({
      month: 11,
      day: 28,
    });
  });
});

describe("lastWeekdayOfMonth", () => {
  it("finds the last Monday of August", () => {
    expect(lastWeekdayOfMonth(2025, 8, MONDAY)).toEqual({
      month: 8,
      day: 25,
    });
  });

  it("handles a month whose last day is the weekday asked for", () => {
    // 31 March 2025 is a Monday.
    expect(lastWeekdayOfMonth(2025, 3, MONDAY)).toEqual({
      month: 3,
      day: 31,
    });
  });

  it("knows February's length in a leap year", () => {
    expect(lastWeekdayOfMonth(2024, 2, MONDAY)).toEqual({
      month: 2,
      day: 26,
    });
    expect(lastWeekdayOfMonth(2023, 2, MONDAY)).toEqual({
      month: 2,
      day: 27,
    });
  });
});
