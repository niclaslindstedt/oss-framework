// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SVG path construction for line / area marks and bar rectangles. Pure
// string-in, string-out: points arrive already projected to pixel space (the
// scales' output), `null` marks a gap in the data, and the result is a `d`
// attribute. Numbers are rounded to a hundredth of a pixel so paths stay
// compact and snapshot-stable.

/** A projected point, or `null` for a gap in the series. */
export type PathPoint = readonly [x: number, y: number] | null;

export type CurveKind = "linear" | "monotone";

export type LinePathOptions = {
  /**
   * `linear` joins points with straight segments; `monotone` draws a cubic
   * that never overshoots the data (Fritsch–Carlson), the safe smoothing for
   * trends.
   */
  curve?: CurveKind;
};

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

// Split a point list into gap-free runs; each run becomes one subpath so a
// gap renders as a break in the stroke, not a bridging segment.
function runs(points: readonly PathPoint[]): [number, number][][] {
  const out: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const p of points) {
    if (p == null || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      if (current.length > 0) out.push(current);
      current = [];
    } else {
      current.push([p[0], p[1]]);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

// Fritsch–Carlson monotone cubic tangents for one run: the curve passes
// through every point and never overshoots between neighbours.
function monotoneTangents(run: readonly [number, number][]): number[] {
  const n = run.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = run[i] ?? [0, 0];
    const p1 = run[i + 1] ?? p0;
    const dx = p1[0] - p0[0];
    slopes.push(dx === 0 ? 0 : (p1[1] - p0[1]) / dx);
  }
  const tangents: number[] = new Array<number>(n).fill(0);
  tangents[0] = slopes[0] ?? 0;
  tangents[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1] ?? 0;
    const b = slopes[i] ?? 0;
    // A sign change (local extremum) flattens the tangent so the curve
    // doesn't invent a bump the data doesn't have.
    tangents[i] = a * b <= 0 ? 0 : (3 * (a + b)) / (a / b + b / a + 4);
  }
  return tangents;
}

function runPath(run: readonly [number, number][], curve: CurveKind): string {
  const first = run[0];
  if (!first) return "";
  let d = `M${fmt(first[0])},${fmt(first[1])}`;
  if (run.length === 1) return d;
  if (curve === "linear") {
    for (const [x, y] of run.slice(1)) d += `L${fmt(x)},${fmt(y)}`;
    return d;
  }
  const t = monotoneTangents(run);
  for (let i = 0; i < run.length - 1; i++) {
    const p0 = run[i];
    const p1 = run[i + 1];
    if (!p0 || !p1) continue;
    const [x0, y0] = p0;
    const [x1, y1] = p1;
    const dx = (x1 - x0) / 3;
    d +=
      `C${fmt(x0 + dx)},${fmt(y0 + dx * (t[i] ?? 0))}` +
      `,${fmt(x1 - dx)},${fmt(y1 - dx * (t[i + 1] ?? 0))}` +
      `,${fmt(x1)},${fmt(y1)}`;
  }
  return d;
}

/**
 * The `d` for a (possibly gapped) polyline. Each gap starts a new subpath; a
 * run of one point emits a bare `M` (no visible stroke — render isolated
 * points as dots if they must show). Empty/all-gap input yields `""`.
 */
export function linePath(
  points: readonly PathPoint[],
  options: LinePathOptions = {},
): string {
  const curve = options.curve ?? "linear";
  return runs(points)
    .map((run) => runPath(run, curve))
    .join("");
}

/**
 * The `d` for a filled area: the line over `points`, closed down to the flat
 * `baseline` (a pixel y). Gaps split the area into separate closed regions.
 */
export function areaPath(
  points: readonly PathPoint[],
  baseline: number,
  options: LinePathOptions = {},
): string {
  const curve = options.curve ?? "linear";
  return runs(points)
    .map((run) => {
      const first = run[0];
      const last = run[run.length - 1];
      if (!first || !last) return "";
      const open = runPath(run, curve);
      return `${open}L${fmt(last[0])},${fmt(baseline)}L${fmt(first[0])},${fmt(baseline)}Z`;
    })
    .join("");
}

/**
 * The `d` for the closed region between a `top` and a `bottom` edge — the
 * shape of one stacked-area layer, whose baseline is the layer below rather
 * than a flat line. Both edges must be index-aligned (same x positions, gaps
 * in the same slots); each gap-free run closes into its own region.
 */
export function bandPath(
  top: readonly PathPoint[],
  bottom: readonly PathPoint[],
  options: LinePathOptions = {},
): string {
  const curve = options.curve ?? "linear";
  const topRuns = runs(top);
  const bottomRuns = runs(bottom);
  return topRuns
    .map((run, i) => {
      const back = bottomRuns[i];
      if (!back) return "";
      const reversed = [...back].reverse();
      // The bottom edge retraces from the top edge's end point: its subpath
      // re-opens with an `L`, not an `M`, so the region closes as one loop.
      const backPath = runPath(reversed, curve).replace(/^M/, "L");
      return `${runPath(run, curve)}${backPath}Z`;
    })
    .join("");
}

/**
 * The `d` for a bar rectangle whose **value end** is rounded and whose
 * baseline end stays square — the "rounded data end anchored to the
 * baseline" bar mark. `side` names the value end. The radius collapses as
 * the bar shrinks so tiny bars never invert.
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  side: "top" | "bottom" | "left" | "right" = "top",
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w === 0 || h === 0) return "";
  const r = Math.min(
    Math.max(0, radius),
    (side === "left" || side === "right" ? h : w) / 2,
    side === "left" || side === "right" ? w : h,
  );
  if (r === 0) {
    return `M${fmt(x)},${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`;
  }
  switch (side) {
    case "top":
      return (
        `M${fmt(x)},${fmt(y + r)}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},${fmt(-r)}` +
        `h${fmt(w - 2 * r)}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},${fmt(r)}` +
        `v${fmt(h - r)}h${fmt(-w)}Z`
      );
    case "bottom":
      return (
        `M${fmt(x)},${fmt(y)}h${fmt(w)}v${fmt(h - r)}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(-r)},${fmt(r)}` +
        `h${fmt(-(w - 2 * r))}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(-r)},${fmt(-r)}Z`
      );
    case "right":
      return (
        `M${fmt(x)},${fmt(y)}h${fmt(w - r)}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},${fmt(r)}` +
        `v${fmt(h - 2 * r)}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(-r)},${fmt(r)}` +
        `h${fmt(-(w - r))}Z`
      );
    case "left":
      return (
        `M${fmt(x + r)},${fmt(y)}h${fmt(w - r)}v${fmt(h)}h${fmt(-(w - r))}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(-r)},${fmt(-r)}` +
        `v${fmt(-(h - 2 * r))}` +
        `a${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},${fmt(-r)}Z`
      );
  }
}
