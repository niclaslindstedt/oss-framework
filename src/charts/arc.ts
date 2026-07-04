// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Donut / pie arc geometry. Pure: values in, SVG path strings out, centred on
// (0,0) so the component positions the ring with a single transform. Angles
// are radians, 0 at 12 o'clock, increasing clockwise (screen convention).

export type DonutArc = {
  /** SVG path for the segment (a ring sector, or a full ring at 100%). */
  d: string;
  /** This segment's share of the total, 0–1. */
  fraction: number;
  /** Segment start/end angle (radians from 12 o'clock, clockwise). */
  startAngle: number;
  endAngle: number;
  /** Angular midpoint — where a label or callout for the segment anchors. */
  midAngle: number;
};

export type DonutArcOptions = {
  /** Outer radius in pixels. */
  radius: number;
  /** Inner (hole) radius; 0 renders a pie. Default: 60% of `radius`. */
  innerRadius?: number;
  /** Where the first segment starts (radians from 12 o'clock). Default 0. */
  startAngle?: number;
  /** Angular gap between segments (radians), split evenly off both ends. */
  padAngle?: number;
};

const TAU = Math.PI * 2;

// Convert our clock-face angle (0 = 12 o'clock, clockwise) to an SVG point.
function point(radius: number, angle: number): [number, number] {
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

function sectorPath(
  outer: number,
  inner: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = point(outer, a0);
  const [ox1, oy1] = point(outer, a1);
  let d =
    `M${fmt(ox0)},${fmt(oy0)}` +
    `A${fmt(outer)},${fmt(outer)} 0 ${large} 1 ${fmt(ox1)},${fmt(oy1)}`;
  if (inner > 0) {
    const [ix1, iy1] = point(inner, a1);
    const [ix0, iy0] = point(inner, a0);
    d +=
      `L${fmt(ix1)},${fmt(iy1)}` +
      `A${fmt(inner)},${fmt(inner)} 0 ${large} 0 ${fmt(ix0)},${fmt(iy0)}Z`;
  } else {
    d += `L0,0Z`;
  }
  return d;
}

// A closed 360° ring (or disc) — the shape a single-segment donut needs,
// since an SVG arc command degenerates when start and end coincide.
function fullRingPath(outer: number, inner: number): string {
  const ring = (r: number, sweep: 0 | 1): string =>
    `M${fmt(0)},${fmt(-r)}` +
    `A${fmt(r)},${fmt(r)} 0 1 ${sweep} ${fmt(0)},${fmt(r)}` +
    `A${fmt(r)},${fmt(r)} 0 1 ${sweep} ${fmt(0)},${fmt(-r)}Z`;
  return inner > 0 ? ring(outer, 1) + ring(inner, 0) : ring(outer, 1);
}

/**
 * Project non-negative `values` into donut segments. Zero (and negative)
 * values yield a zero-fraction segment with an empty `d`, so the output
 * stays index-aligned with the input for colour/label pairing. An all-zero
 * input yields only empty segments. A single non-zero segment renders as the
 * full ring. Segments paint with `fill-rule: evenodd` (the full ring's hole
 * depends on it).
 */
export function donutArcs(
  values: readonly number[],
  options: DonutArcOptions,
): DonutArc[] {
  const outer = Math.max(0, options.radius);
  const inner = Math.min(
    Math.max(0, options.innerRadius ?? outer * 0.6),
    outer,
  );
  const start = options.startAngle ?? 0;
  const pad = Math.max(0, options.padAngle ?? 0);

  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((sum, v) => sum + v, 0);
  const nonZero = clean.filter((v) => v > 0).length;

  let cursor = start;
  return clean.map((v) => {
    const fraction = total > 0 ? v / total : 0;
    const sweep = fraction * TAU;
    const a0 = cursor;
    const a1 = cursor + sweep;
    cursor = a1;
    if (fraction === 0) {
      return { d: "", fraction: 0, startAngle: a0, endAngle: a0, midAngle: a0 };
    }
    if (fraction === 1) {
      return {
        d: fullRingPath(outer, inner),
        fraction,
        startAngle: a0,
        endAngle: a1,
        midAngle: a0 + Math.PI,
      };
    }
    // Padding shaves both ends, but never more than the segment can give —
    // slivers keep a hairline presence instead of inverting. Only applied
    // when there is more than one visible segment to separate.
    const trim = nonZero > 1 ? Math.min(pad / 2, sweep / 4) : 0;
    return {
      d: sectorPath(outer, inner, a0 + trim, a1 - trim),
      fraction,
      startAngle: a0,
      endAngle: a1,
      midAngle: (a0 + a1) / 2,
    };
  });
}
