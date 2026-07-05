// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatCompact,
  formatDate,
  formatDuration,
  formatNumber,
  formatRelative,
  monthName,
  weekdayNames,
} from "../src/format/index.ts";

// ICU sometimes emits non-breaking / narrow no-break spaces where a plain
// space reads the same; normalize so assertions state intent, not the exact
// codepoint an ICU version chose.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("formatNumber", () => {
  it("renders standard locale notation", () => {
    expect(formatNumber(1234.5, "en-US")).toBe("1,234.5");
    expect(plain(formatNumber(1234.5, "sv-SE"))).toBe("1 234,5");
  });

  it("passes options through to Intl.NumberFormat", () => {
    expect(formatNumber(0.42, "en-US", { style: "percent" })).toBe("42%");
    expect(formatNumber(3.14159, "en-US", { maximumFractionDigits: 2 })).toBe(
      "3.14",
    );
  });

  it("returns empty for non-finite input", () => {
    expect(formatNumber(Number.NaN, "en-US")).toBe("");
    expect(formatNumber(Number.POSITIVE_INFINITY, "en-US")).toBe("");
  });
});

describe("formatCompact", () => {
  it("renders compact notation with at most one fraction digit", () => {
    expect(formatCompact(1_234, "en-US")).toBe("1.2K");
    expect(formatCompact(3_400_000, "en-US")).toBe("3.4M");
    expect(formatCompact(999, "en-US")).toBe("999");
  });

  it("returns empty for non-finite input", () => {
    expect(formatCompact(Number.NaN, "en-US")).toBe("");
  });
});

describe("formatDate", () => {
  const date = new Date(2026, 6, 5); // 5 July 2026, local time

  it("defaults to the locale's medium date style", () => {
    expect(formatDate(date, "en-US")).toBe("Jul 5, 2026");
    expect(formatDate(date, "sv-SE")).toBe("5 juli 2026");
  });

  it("passes options through to Intl.DateTimeFormat", () => {
    expect(formatDate(date, "en-US", { month: "long", day: "numeric" })).toBe(
      "July 5",
    );
  });

  it("returns empty for an invalid date", () => {
    expect(formatDate(new Date(Number.NaN), "en-US")).toBe("");
  });
});

describe("formatRelative", () => {
  const now = new Date(2026, 6, 5, 12, 0, 0);
  const at = (ms: number) => new Date(now.getTime() + ms);

  it("speaks idioms through numeric: auto", () => {
    expect(formatRelative(at(-24 * 3_600_000), now, "en-US")).toBe("yesterday");
    expect(formatRelative(at(24 * 3_600_000), now, "en-US")).toBe("tomorrow");
    expect(formatRelative(now, now, "en-US")).toBe("now");
  });

  it("climbs the unit ladder with the distance", () => {
    expect(formatRelative(at(-30_000), now, "en-US")).toBe("30 seconds ago");
    expect(formatRelative(at(-5 * 60_000), now, "en-US")).toBe("5 minutes ago");
    expect(formatRelative(at(-2 * 3_600_000), now, "en-US")).toBe(
      "2 hours ago",
    );
    expect(formatRelative(at(3 * 86_400_000), now, "en-US")).toBe("in 3 days");
    expect(formatRelative(at(-65 * 86_400_000), now, "en-US")).toBe(
      "2 months ago",
    );
    expect(formatRelative(at(2 * 366 * 86_400_000), now, "en-US")).toBe(
      "in 2 years",
    );
  });

  it("localizes", () => {
    expect(formatRelative(at(-24 * 3_600_000), now, "sv-SE")).toBe("i går");
  });

  it("returns empty for an invalid date", () => {
    expect(formatRelative(new Date(Number.NaN), now, "en-US")).toBe("");
  });
});

describe("formatDuration", () => {
  it("renders the largest unit plus its non-zero neighbour", () => {
    expect(plain(formatDuration(4_980_000, "en-US"))).toBe("1 hr 23 min");
    expect(plain(formatDuration(45_000, "en-US"))).toBe("45 sec");
    expect(plain(formatDuration(2 * 86_400_000 + 3 * 3_600_000, "en-US"))).toBe(
      "2 days 3 hr",
    );
  });

  it("skips a zero middle unit instead of pairing across it", () => {
    // 1 h 0 min 30 s — "1 hr 30 sec" would misread as 1.5 hours.
    expect(plain(formatDuration(3_600_000 + 30_000, "en-US"))).toBe("1 hr");
  });

  it("renders sub-second spans as zero seconds", () => {
    expect(plain(formatDuration(500, "en-US"))).toBe("0 sec");
    expect(plain(formatDuration(0, "en-US"))).toBe("0 sec");
  });

  it("supports narrow and long widths", () => {
    expect(plain(formatDuration(4_980_000, "en-US", "narrow"))).toBe("1h 23m");
    expect(plain(formatDuration(4_980_000, "en-US", "long"))).toBe(
      "1 hour 23 minutes",
    );
  });

  it("formats a negative span by absolute value and empty for non-finite", () => {
    expect(plain(formatDuration(-45_000, "en-US"))).toBe("45 sec");
    expect(formatDuration(Number.NaN, "en-US")).toBe("");
  });
});

describe("weekdayNames", () => {
  it("starts on Monday by default (ISO-8601)", () => {
    expect(weekdayNames("en-US")).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("rotates to any week start", () => {
    expect(weekdayNames("en-US", "short", 0)[0]).toBe("Sun");
    expect(weekdayNames("en-US", "short", 6)[0]).toBe("Sat");
    expect(weekdayNames("en-US", "short", 6)[1]).toBe("Sun");
  });

  it("supports widths and locales", () => {
    expect(weekdayNames("en-US", "long", 0)[0]).toBe("Sunday");
    expect(weekdayNames("sv-SE", "short")[0]).toBe("mån");
    expect(weekdayNames("en-US", "narrow", 0)).toEqual([
      "S",
      "M",
      "T",
      "W",
      "T",
      "F",
      "S",
    ]);
  });
});

describe("monthName", () => {
  it("names 1-based months", () => {
    expect(monthName(1, "en-US")).toBe("January");
    expect(monthName(12, "en-US")).toBe("December");
    expect(monthName(7, "sv-SE")).toBe("juli");
    expect(monthName(7, "en-US", "short")).toBe("Jul");
  });

  it("returns empty out of range", () => {
    expect(monthName(0, "en-US")).toBe("");
    expect(monthName(13, "en-US")).toBe("");
    expect(monthName(1.5, "en-US")).toBe("");
  });
});
