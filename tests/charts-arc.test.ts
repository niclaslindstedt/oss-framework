// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { donutArcs } from "../src/charts/index.ts";

describe("donutArcs", () => {
  it("splits equal values into equal fractions with correct midAngles", () => {
    const arcs = donutArcs([1, 1, 1, 1], { radius: 50 });
    expect(arcs).toHaveLength(4);
    for (const arc of arcs) expect(arc.fraction).toBeCloseTo(0.25);
    expect(arcs[0]!.midAngle).toBeCloseTo(Math.PI / 4);
    expect(arcs[1]!.midAngle).toBeCloseTo((3 * Math.PI) / 4);
  });

  it("keeps zero and negative values index-aligned with empty paths", () => {
    const arcs = donutArcs([0, 3, -2], { radius: 50 });
    expect(arcs).toHaveLength(3);
    expect(arcs[0]!.d).toBe("");
    expect(arcs[0]!.fraction).toBe(0);
    expect(arcs[1]!.fraction).toBe(1);
    expect(arcs[2]!.d).toBe("");
  });

  it("renders a lone segment as a full ring, not a degenerate arc", () => {
    const arcs = donutArcs([5], { radius: 50 });
    const d = arcs[0]!.d;
    // Outer ring + inner hole: four arc commands, two closed subpaths.
    expect(d.match(/A/g)).toHaveLength(4);
    expect(d.match(/Z/g)).toHaveLength(2);
    expect(arcs[0]!.fraction).toBe(1);
  });

  it("renders a pie (innerRadius 0) sector through the centre", () => {
    const arcs = donutArcs([1, 1], { radius: 50, innerRadius: 0 });
    expect(arcs[0]!.d).toContain("L0,0Z");
  });

  it("yields only empty segments for an all-zero input", () => {
    const arcs = donutArcs([0, 0], { radius: 50 });
    expect(arcs.every((a) => a.d === "" && a.fraction === 0)).toBe(true);
  });

  it("padAngle opens a gap without changing fractions", () => {
    const plain = donutArcs([1, 1], { radius: 50 });
    const padded = donutArcs([1, 1], { radius: 50, padAngle: 0.1 });
    expect(padded[0]!.fraction).toBeCloseTo(plain[0]!.fraction);
    expect(padded[0]!.d).not.toBe(plain[0]!.d);
  });

  it("uses the large-arc flag for a majority segment", () => {
    const arcs = donutArcs([3, 1], { radius: 50, innerRadius: 0 });
    // 75% sweep crosses π, so the large-arc flag must be set.
    expect(arcs[0]!.d).toMatch(/A50,50 0 1 1/);
    expect(arcs[1]!.d).toMatch(/A50,50 0 0 1/);
  });
});
