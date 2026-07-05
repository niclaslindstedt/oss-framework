// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  clampTransform,
  drawRect,
  fitContain,
  IDENTITY_TRANSFORM,
  panBy,
  zoomAboutPoint,
  type ViewTransform,
} from "../src/viewer/transform.ts";

// The pure geometry core: cover-fit projection, clamp bounds, the
// zoom-about-anchor invariant, contain-fit math, and resolution
// independence. All DOM-free.

/** Which content-space coordinate (as a fraction of the drawn width/height)
 *  sits under viewport point `p` (in viewport fractions) at side `size`. */
function contentPointUnder(
  contentW: number,
  contentH: number,
  size: number,
  t: ViewTransform,
  p: { x: number; y: number },
): { u: number; v: number } {
  const r = drawRect(contentW, contentH, size, t);
  return { u: (p.x * size - r.x) / r.w, v: (p.y * size - r.y) / r.h };
}

describe("drawRect", () => {
  it("cover-fits a landscape image centred at the identity framing", () => {
    // 200x100 into a 100 viewport: covers by height, so width overflows.
    const r = drawRect(200, 100, 100, IDENTITY_TRANSFORM);
    expect(r.h).toBe(100);
    expect(r.w).toBe(200);
    expect(r.y).toBe(0);
    expect(r.x).toBe(-50); // centred: (100-200)/2
  });

  it("cover-fits a portrait image by width", () => {
    const r = drawRect(100, 200, 100, IDENTITY_TRANSFORM);
    expect(r.w).toBe(100);
    expect(r.h).toBe(200);
    expect(r.x).toBe(0);
    expect(r.y).toBe(-50);
  });

  it("scales the content about the centre", () => {
    const r = drawRect(100, 100, 100, { scale: 2, tx: 0, ty: 0 });
    expect(r.w).toBe(200);
    expect(r.h).toBe(200);
    expect(r.x).toBe(-50);
    expect(r.y).toBe(-50);
  });

  it("offsets by tx/ty in viewport-side units", () => {
    const r = drawRect(100, 100, 100, { scale: 1, tx: 0.25, ty: -0.5 });
    expect(r.x).toBe(25);
    expect(r.y).toBe(-50);
  });

  it("floors an under-1 scale at the cover baseline", () => {
    const r = drawRect(100, 100, 100, { scale: 0.2, tx: 0, ty: 0 });
    expect(r.w).toBe(100);
    expect(r.h).toBe(100);
  });

  it("is resolution-independent: doubling the size doubles the rect", () => {
    const t = { scale: 1.7, tx: 0.12, ty: -0.31 };
    const small = drawRect(320, 200, 100, t);
    const large = drawRect(320, 200, 200, t);
    expect(large.x).toBeCloseTo(small.x * 2);
    expect(large.y).toBeCloseTo(small.y * 2);
    expect(large.w).toBeCloseTo(small.w * 2);
    expect(large.h).toBeCloseTo(small.h * 2);
  });
});

describe("clampTransform", () => {
  it("clamps the pan so the content can't uncover the viewport", () => {
    // Landscape: horizontal pan allowed, vertical pinned; scale floored to 1.
    const t = clampTransform(200, 100, { scale: 0.2, tx: 5, ty: 5 });
    expect(t.scale).toBe(1);
    expect(t.ty).toBe(0);
    expect(t.tx).toBeCloseTo(0.5); // (w-1)/2 with w=2 in unit terms
  });

  it("clamps symmetrically on the negative side", () => {
    const t = clampTransform(200, 100, { scale: 1, tx: -5, ty: -5 });
    expect(t.tx).toBeCloseTo(-0.5);
    expect(t.ty).toBeCloseTo(0);
  });

  it("widens the pan bounds as the scale grows", () => {
    // Square content at scale 3: content is 3x the viewport, so the centre
    // may shift up to (3-1)/2 = 1 viewport-side in each axis.
    const t = clampTransform(100, 100, { scale: 3, tx: 9, ty: -9 });
    expect(t.tx).toBeCloseTo(1);
    expect(t.ty).toBeCloseTo(-1);
  });

  it("leaves an in-bounds framing untouched", () => {
    const t = { scale: 2, tx: 0.3, ty: -0.2 };
    expect(clampTransform(100, 100, t)).toEqual(t);
  });

  it("never exposes a margin after clamping (drawRect stays covering)", () => {
    const wild = { scale: 4, tx: 7, ty: -7 };
    const t = clampTransform(300, 200, wild);
    const r = drawRect(300, 200, 100, t);
    expect(r.x).toBeLessThanOrEqual(0);
    expect(r.y).toBeLessThanOrEqual(0);
    expect(r.x + r.w).toBeGreaterThanOrEqual(100);
    expect(r.y + r.h).toBeGreaterThanOrEqual(100);
  });
});

describe("panBy", () => {
  it("shifts the centre offsets without touching the scale", () => {
    const t = panBy({ scale: 2, tx: 0.1, ty: 0.2 }, 0.05, -0.1);
    expect(t.scale).toBe(2);
    expect(t.tx).toBeCloseTo(0.15, 10);
    expect(t.ty).toBeCloseTo(0.1, 10);
  });
});

describe("zoomAboutPoint", () => {
  it("keeps the content point under the anchor fixed (the invariant)", () => {
    const t1 = { scale: 1.5, tx: 0.1, ty: -0.05 };
    const anchor = { x: 0.25, y: 0.7 };
    const t2 = zoomAboutPoint(t1, 2.5, anchor);
    const before = contentPointUnder(200, 100, 100, t1, anchor);
    const after = contentPointUnder(200, 100, 100, t2, anchor);
    expect(after.u).toBeCloseTo(before.u, 10);
    expect(after.v).toBeCloseTo(before.v, 10);
    expect(t2.scale).toBe(2.5);
  });

  it("holds the invariant when zooming out", () => {
    const t1 = { scale: 4, tx: -0.6, ty: 0.4 };
    const anchor = { x: 0.9, y: 0.1 };
    const t2 = zoomAboutPoint(t1, 2, anchor);
    const before = contentPointUnder(120, 300, 100, t1, anchor);
    const after = contentPointUnder(120, 300, 100, t2, anchor);
    expect(after.u).toBeCloseTo(before.u, 10);
    expect(after.v).toBeCloseTo(before.v, 10);
  });

  it("holds the invariant at any viewport resolution", () => {
    const t1 = { scale: 1.2, tx: 0.05, ty: 0.05 };
    const anchor = { x: 0.33, y: 0.66 };
    const t2 = zoomAboutPoint(t1, 3, anchor);
    for (const size of [64, 100, 512, 1000]) {
      const before = contentPointUnder(200, 100, size, t1, anchor);
      const after = contentPointUnder(200, 100, size, t2, anchor);
      expect(after.u).toBeCloseTo(before.u, 10);
      expect(after.v).toBeCloseTo(before.v, 10);
    }
  });

  it("zooming about the centre only changes the scale", () => {
    const t = zoomAboutPoint({ scale: 1, tx: 0, ty: 0 }, 2, { x: 0.5, y: 0.5 });
    expect(t).toEqual({ scale: 2, tx: 0, ty: 0 });
  });

  it("uses the effective (floored) scale ratio across the cover baseline", () => {
    // From an under-1 scale, the on-screen content is drawn at the floor, so
    // zooming must ratio against 1 — not against the raw 0.5 — or the anchor
    // would jump.
    const t1 = { scale: 0.5, tx: 0.1, ty: 0 };
    const anchor = { x: 0.2, y: 0.5 };
    const t2 = zoomAboutPoint(t1, 2, anchor);
    const before = contentPointUnder(100, 100, 100, t1, anchor);
    const after = contentPointUnder(100, 100, 100, t2, anchor);
    expect(after.u).toBeCloseTo(before.u, 10);
    expect(after.v).toBeCloseTo(before.v, 10);
  });

  it("is a no-op at an unchanged scale", () => {
    const t1 = { scale: 2, tx: 0.2, ty: -0.1 };
    const t2 = zoomAboutPoint(t1, 2, { x: 0.1, y: 0.9 });
    expect(t2.scale).toBe(2);
    expect(t2.tx).toBeCloseTo(t1.tx, 10);
    expect(t2.ty).toBeCloseTo(t1.ty, 10);
  });
});

describe("fitContain", () => {
  it("letterboxes a wide image in a square viewport", () => {
    const r = fitContain(200, 100, 100, 100);
    expect(r).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });

  it("pillarboxes a tall image in a wide viewport", () => {
    const r = fitContain(100, 200, 300, 100);
    expect(r).toEqual({ x: 125, y: 0, w: 50, h: 100 });
  });

  it("fills exactly when the aspect ratios match", () => {
    expect(fitContain(400, 300, 800, 600)).toEqual({
      x: 0,
      y: 0,
      w: 800,
      h: 600,
    });
  });

  it("scales up small content to fill the viewport", () => {
    const r = fitContain(10, 10, 500, 300);
    expect(r).toEqual({ x: 100, y: 0, w: 300, h: 300 });
  });

  it("returns an empty rect for degenerate input", () => {
    expect(fitContain(0, 100, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 100, 100, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
