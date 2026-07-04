// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  bandScale,
  linearScale,
  linearTicks,
  timeScale,
  timeTicks,
} from "../src/charts/index.ts";

describe("linearTicks", () => {
  it("steps on the 1/2/5 lattice", () => {
    expect(linearTicks([0, 10], 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(linearTicks([0, 100], 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(linearTicks([0, 1], 2)).toEqual([0, 0.5, 1]);
  });

  it("snaps fractional steps clear of binary float noise", () => {
    expect(linearTicks([0, 0.3], 5)).toEqual([
      0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3,
    ]);
  });

  it("only emits ticks inside the domain", () => {
    const ticks = linearTicks([3, 17], 5);
    expect(ticks[0]).toBeGreaterThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(17);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it("handles degenerate and reversed domains", () => {
    expect(linearTicks([5, 5])).toEqual([5]);
    expect(linearTicks([10, 0], 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(linearTicks([0, Number.NaN])).toEqual([]);
  });

  it("keeps a lattice-point top bound despite float accumulation", () => {
    const ticks = linearTicks([0, 0.6], 5);
    expect(ticks[ticks.length - 1]).toBe(0.6);
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range linearly", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
    expect(s(20)).toBe(200); // extrapolates by default
  });

  it("clamps to the range when asked", () => {
    const s = linearScale([0, 10], [0, 100], { clamp: true });
    expect(s(-5)).toBe(0);
    expect(s(20)).toBe(100);
  });

  it("nices the domain outward to tick-aligned bounds", () => {
    const s = linearScale([0.2, 9.7], [0, 1], { nice: true });
    expect(s.domain).toEqual([0, 10]);
  });

  it("maps a zero-span domain to the range midpoint", () => {
    const s = linearScale([4, 4], [0, 100]);
    expect(s(4)).toBe(50);
    expect(s(999)).toBe(50);
  });

  it("supports inverted ranges (the SVG y axis)", () => {
    const s = linearScale([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(0);
  });
});

describe("bandScale", () => {
  it("lays out non-overlapping bands across the range", () => {
    const b = bandScale(4, [0, 100]);
    expect(b.bandwidth).toBeCloseTo(20);
    expect(b.position(0)).toBeCloseTo(2.5);
    expect(b.position(3)).toBeCloseTo(77.5);
    // The last band's far edge plus outer padding lands on the range end.
    expect(b.position(3) + b.bandwidth + 2.5).toBeCloseTo(100);
  });

  it("zero padding fills the range edge to edge", () => {
    const b = bandScale(2, [0, 100], { paddingInner: 0, paddingOuter: 0 });
    expect(b.bandwidth).toBeCloseTo(50);
    expect(b.position(0)).toBeCloseTo(0);
    expect(b.position(1)).toBeCloseTo(50);
  });

  it("survives zero categories", () => {
    const b = bandScale(0, [0, 100]);
    expect(b.bandwidth).toBe(0);
  });
});

describe("timeScale", () => {
  it("maps dates linearly onto the range", () => {
    const a = new Date(2026, 0, 1);
    const b = new Date(2026, 0, 11);
    const s = timeScale([a, b], [0, 100]);
    expect(s(a)).toBe(0);
    expect(s(b)).toBe(100);
    expect(s(new Date(2026, 0, 6))).toBe(50);
  });
});

describe("timeTicks", () => {
  it("picks whole hours for an intra-day domain", () => {
    const ticks = timeTicks(
      [new Date(2026, 6, 4, 0, 30), new Date(2026, 6, 4, 11, 30)],
      5,
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t.unit).toBe("hour");
      expect(t.value.getMinutes()).toBe(0);
      expect(t.value.getHours() % 3).toBe(0);
    }
  });

  it("picks local midnights for a few days", () => {
    const ticks = timeTicks(
      [new Date(2026, 6, 1, 5, 0), new Date(2026, 6, 4, 20, 0)],
      5,
    );
    expect(ticks.map((t) => t.value.getDate())).toEqual([2, 3, 4]);
    for (const t of ticks) {
      expect(t.unit).toBe("day");
      expect(t.value.getHours()).toBe(0);
    }
  });

  it("aligns week ticks to Mondays", () => {
    const ticks = timeTicks([new Date(2026, 5, 1), new Date(2026, 6, 4)], 5);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t.unit).toBe("week");
      expect(t.value.getDay()).toBe(1);
    }
  });

  it("walks real month boundaries for a year-wide domain", () => {
    const ticks = timeTicks([new Date(2026, 0, 15), new Date(2026, 11, 20)], 5);
    expect(ticks.map((t) => t.value.getMonth())).toEqual([3, 6, 9]);
    for (const t of ticks) {
      expect(t.unit).toBe("month");
      expect(t.value.getDate()).toBe(1);
    }
  });

  it("falls back to 1/2/5-stepped years for very wide domains", () => {
    const ticks = timeTicks([new Date(2010, 2, 1), new Date(2026, 4, 1)], 5);
    expect(ticks.map((t) => t.value.getFullYear())).toEqual([2015, 2020, 2025]);
    for (const t of ticks) expect(t.unit).toBe("year");
  });

  it("handles a zero-span domain", () => {
    const d = new Date(2026, 6, 4);
    expect(timeTicks([d, d])).toEqual([{ value: d, unit: "day" }]);
  });
});
