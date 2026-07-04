// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Stacking: turn N series of values into N series of [base, top] extents so
// stacked bars / areas can render each layer from where the previous one
// ended. Positive values accumulate upward and negative values downward
// (diverging stacking), so a mixed-sign stack never overlaps itself.

/** One stacked extent: the layer spans `y0`→`y1` in data units. */
export type StackedExtent = { y0: number; y1: number };

/**
 * Stack `series[s][i]` (series-major, index-aligned) into per-layer extents.
 * A `null` (missing) value contributes nothing: its extent is zero-height at
 * the running total, so the layers above it stack as if it weren't there.
 */
export function stackSeries(
  series: readonly (readonly (number | null)[])[],
): StackedExtent[][] {
  const length = series.reduce((max, s) => Math.max(max, s.length), 0);
  const positive = new Array<number>(length).fill(0);
  const negative = new Array<number>(length).fill(0);
  return series.map((s) => {
    const layer: StackedExtent[] = [];
    for (let i = 0; i < length; i++) {
      const raw = s[i];
      const v = raw != null && Number.isFinite(raw) ? raw : 0;
      if (v >= 0) {
        const base = positive[i] ?? 0;
        layer.push({ y0: base, y1: base + v });
        positive[i] = base + v;
      } else {
        const base = negative[i] ?? 0;
        layer.push({ y0: base + v, y1: base });
        negative[i] = base + v;
      }
    }
    return layer;
  });
}

/**
 * The [min, max] data extent of a stacked value set — the y-domain a chart
 * needs to fit every layer. Always includes 0 (the stacking baseline).
 */
export function stackedExtent(
  stacked: readonly (readonly StackedExtent[])[],
): [number, number] {
  let min = 0;
  let max = 0;
  for (const layer of stacked) {
    for (const { y0, y1 } of layer) {
      if (y0 < min) min = y0;
      if (y1 > max) max = y1;
    }
  }
  return [min, max];
}

/**
 * The [min, max] across plain (unstacked) series, ignoring `null` gaps.
 * Includes 0 so bars and areas keep an honest baseline. Returns [0, 1] for
 * all-empty input so a degenerate chart still has a drawable domain.
 */
export function seriesExtent(
  series: readonly (readonly (number | null)[])[],
): [number, number] {
  let min = 0;
  let max = 0;
  let seen = false;
  for (const s of series) {
    for (const v of s) {
      if (v == null || !Number.isFinite(v)) continue;
      seen = true;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!seen || (min === 0 && max === 0)) return [0, 1];
  return [min, max];
}
