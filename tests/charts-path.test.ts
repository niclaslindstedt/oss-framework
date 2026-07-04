// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  areaPath,
  bandPath,
  barPath,
  linePath,
  seriesExtent,
  stackSeries,
  stackedExtent,
} from "../src/charts/index.ts";

describe("linePath", () => {
  it("joins points with line segments", () => {
    expect(
      linePath([
        [0, 0],
        [10, 10],
        [20, 5],
      ]),
    ).toBe("M0,0L10,10L20,5");
  });

  it("breaks the stroke at gaps instead of bridging them", () => {
    const d = linePath([[0, 0], null, [10, 10], [20, 5]]);
    expect(d).toBe("M0,0M10,10L20,5");
  });

  it("treats non-finite coordinates as gaps", () => {
    expect(
      linePath([
        [0, 0],
        [Number.NaN, 5],
        [20, 5],
      ]),
    ).toBe("M0,0M20,5");
  });

  it("emits a bare move for a single point and nothing for no points", () => {
    expect(linePath([[5, 5]])).toBe("M5,5");
    expect(linePath([])).toBe("");
    expect(linePath([null, null])).toBe("");
  });

  it("monotone keeps flat data flat (no invented bumps)", () => {
    const d = linePath(
      [
        [0, 10],
        [10, 10],
        [20, 10],
      ],
      { curve: "monotone" },
    );
    expect(d).toBe("M0,10C3.33,10,6.67,10,10,10C13.33,10,16.67,10,20,10");
  });

  it("rounds coordinates to hundredths", () => {
    expect(linePath([[1 / 3, 2 / 3]])).toBe("M0.33,0.67");
  });
});

describe("areaPath", () => {
  it("closes each run down to the baseline", () => {
    expect(
      areaPath(
        [
          [0, 0],
          [10, 10],
        ],
        20,
      ),
    ).toBe("M0,0L10,10L10,20L0,20Z");
  });

  it("closes gapped runs into separate regions", () => {
    const d = areaPath([[0, 0], null, [10, 5], [20, 5]], 20);
    expect(d).toBe("M0,0L0,20L0,20ZM10,5L20,5L20,20L10,20Z");
  });
});

describe("bandPath", () => {
  it("closes the region between a top and a bottom edge", () => {
    const d = bandPath(
      [
        [0, 0],
        [10, 0],
      ],
      [
        [0, 5],
        [10, 5],
      ],
    );
    expect(d).toBe("M0,0L10,0L10,5L0,5Z");
  });
});

describe("barPath", () => {
  it("renders a square bar at radius 0", () => {
    expect(barPath(0, 0, 10, 20, 0)).toBe("M0,0h10v20h-10Z");
  });

  it("rounds only the value end", () => {
    const d = barPath(0, 0, 10, 20, 4, "top");
    expect(d.startsWith("M0,4a4,4 0 0 1 4,-4")).toBe(true);
    expect(d.endsWith("v16h-10Z")).toBe(true);
  });

  it("collapses the radius on bars too small to round", () => {
    const d = barPath(0, 0, 4, 20, 4, "top");
    // Radius clamps to half the width (2), so the arcs are 2px.
    expect(d).toContain("a2,2");
  });

  it("returns nothing for a zero-size bar", () => {
    expect(barPath(0, 0, 0, 20, 4)).toBe("");
    expect(barPath(0, 0, 10, 0, 4)).toBe("");
  });
});

describe("stackSeries", () => {
  it("accumulates layers upward", () => {
    expect(
      stackSeries([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([
      [
        { y0: 0, y1: 1 },
        { y0: 0, y1: 2 },
      ],
      [
        { y0: 1, y1: 4 },
        { y0: 2, y1: 6 },
      ],
    ]);
  });

  it("stacks negatives downward without overlapping the positives", () => {
    expect(stackSeries([[1], [-2], [3]])).toEqual([
      [{ y0: 0, y1: 1 }],
      [{ y0: -2, y1: 0 }],
      [{ y0: 1, y1: 4 }],
    ]);
  });

  it("treats nulls as zero-height at the running total", () => {
    expect(
      stackSeries([
        [null, 2],
        [1, 1],
      ]),
    ).toEqual([
      [
        { y0: 0, y1: 0 },
        { y0: 0, y1: 2 },
      ],
      [
        { y0: 0, y1: 1 },
        { y0: 2, y1: 3 },
      ],
    ]);
  });
});

describe("extents", () => {
  it("stackedExtent spans the full stack and includes 0", () => {
    const stacked = stackSeries([
      [1, 2],
      [-3, 4],
    ]);
    expect(stackedExtent(stacked)).toEqual([-3, 6]);
  });

  it("seriesExtent includes 0 and skips gaps", () => {
    expect(seriesExtent([[2, 5]])).toEqual([0, 5]);
    expect(seriesExtent([[-3, 2]])).toEqual([-3, 2]);
    expect(seriesExtent([[null, null]])).toEqual([0, 1]);
    expect(seriesExtent([])).toEqual([0, 1]);
  });
});
