// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  bandFontPx,
  fixedFontPx,
  resolveFontPx,
  scaleBand,
  type SizeBand,
} from "../src/fit/band.ts";

const CELL: SizeBand = { maxPx: 13, minPx: 8, startAt: 12, floorAt: 90 };
const ROW: SizeBand = { maxPx: 16, minPx: 10, startAt: 60, floorAt: 260 };

describe("bandFontPx", () => {
  it("holds the top of the band until the ramp starts", () => {
    expect(bandFontPx(0, CELL)).toBe(13);
    expect(bandFontPx(CELL.startAt, CELL)).toBe(13);
  });

  it("is at the floor from `floorAt` on, and never below it", () => {
    expect(bandFontPx(CELL.floorAt, CELL)).toBe(8);
    expect(bandFontPx(10_000, CELL)).toBe(8);
  });

  it("ramps linearly in between", () => {
    const mid = (CELL.startAt + CELL.floorAt) / 2;
    expect(bandFontPx(mid, CELL)).toBe(10.5);
  });

  it("never leaves the band", () => {
    for (let n = 0; n <= 300; n += 7) {
      const px = bandFontPx(n, CELL);
      expect(px).toBeGreaterThanOrEqual(CELL.minPx);
      expect(px).toBeLessThanOrEqual(CELL.maxPx);
    }
  });

  it("never grows as the text does", () => {
    let last = Infinity;
    for (let n = 0; n <= 300; n += 1) {
      const px = bandFontPx(n, CELL);
      expect(px).toBeLessThanOrEqual(last);
      last = px;
    }
  });
});

describe("fixedFontPx", () => {
  it("orders the three steps, inside the band", () => {
    const small = fixedFontPx("small", ROW);
    const medium = fixedFontPx("medium", ROW);
    const large = fixedFontPx("large", ROW);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    expect(small).toBeGreaterThanOrEqual(ROW.minPx);
    expect(large).toBeLessThanOrEqual(ROW.maxPx);
  });

  it("never puts `small` below the floor, however narrow the band", () => {
    const tight: SizeBand = { maxPx: 9, minPx: 8, startAt: 5, floorAt: 40 };
    expect(fixedFontPx("small", tight)).toBeGreaterThanOrEqual(8);
  });

  it("keeps `large` near — but under — the size a short string gets", () => {
    expect(fixedFontPx("large", ROW)).toBeLessThanOrEqual(bandFontPx(0, ROW));
    expect(fixedFontPx("large", ROW)).toBeGreaterThan(
      (ROW.minPx + ROW.maxPx) / 2,
    );
  });

  it("scales its steps with the band it is given", () => {
    expect(fixedFontPx("medium", CELL)).not.toBe(fixedFontPx("medium", ROW));
  });
});

describe("resolveFontPx", () => {
  it("takes the curve on auto and the step otherwise", () => {
    expect(resolveFontPx(200, CELL, "auto")).toBe(bandFontPx(200, CELL));
    expect(resolveFontPx(200, CELL, "large")).toBe(fixedFontPx("large", CELL));
  });

  it("ignores the length once a step is pinned", () => {
    expect(resolveFontPx(0, CELL, "small")).toBe(
      resolveFontPx(5000, CELL, "small"),
    );
  });
});

describe("scaleBand", () => {
  it("scales both ends and leaves the counts alone", () => {
    expect(scaleBand(CELL, 2)).toEqual({
      maxPx: 26,
      minPx: 16,
      startAt: 12,
      floorAt: 90,
    });
  });

  it("hands the band straight back at 1", () => {
    expect(scaleBand(CELL, 1)).toBe(CELL);
  });

  it("refuses a factor that isn't a positive number", () => {
    expect(scaleBand(CELL, 0)).toBe(CELL);
    expect(scaleBand(CELL, -2)).toBe(CELL);
    expect(scaleBand(CELL, Number.NaN)).toBe(CELL);
    expect(scaleBand(CELL, Number.POSITIVE_INFINITY)).toBe(CELL);
  });

  it("rounds to a tenth of a pixel", () => {
    expect(scaleBand(CELL, 1.333)).toEqual({
      maxPx: 17.3,
      minPx: 10.7,
      startAt: 12,
      floorAt: 90,
    });
  });
});
