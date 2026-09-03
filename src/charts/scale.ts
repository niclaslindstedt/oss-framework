// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure scale + tick math — the DOM-free half every chart component projects
// data through. A scale maps a data domain onto a pixel range; ticks pick the
// "nice" domain values an axis labels. Nothing here touches the DOM or React,
// so the behaviour (1/2/5 stepping, degenerate domains, time-unit choice) is
// cheap to unit-test.

/** A linear domain→range mapping, callable directly: `scale(v)` → pixel. */
export type Scale = {
  (v: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
};

/** A time-domain scale, callable with a `Date`. */
export type TimeScale = {
  (d: Date): number;
  domain: readonly [Date, Date];
  range: readonly [number, number];
};

export type LinearScaleOptions = {
  /** Expand the domain outward to tick-aligned bounds (axis-friendly). */
  nice?: boolean;
  /** Clamp outputs to the range instead of extrapolating past it. */
  clamp?: boolean;
};

// The 1/2/5 tick step for a span aimed at ~`count` ticks. Thresholds are the
// geometric midpoints between candidate steps (√2, √10 …) so the chosen step
// lands nearest the ideal, matching the familiar d3 behaviour.
function tickStep(lo: number, hi: number, count: number): number {
  const raw = (hi - lo) / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const ratio = raw / magnitude;
  const factor = ratio >= 7.07 ? 10 : ratio >= 3.16 ? 5 : ratio >= 1.41 ? 2 : 1;
  return magnitude * factor;
}

// Snap a computed tick back onto the step lattice, clearing binary float noise
// (0.1 + 0.2 style) so labels render "0.3", not "0.30000000000000004".
function snapToStep(v: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(decimals));
}

/**
 * Tick values for a linear domain: multiples of a 1/2/5-stepped interval that
 * fall inside the domain, in ascending order. A zero-span domain yields the
 * single value; a non-finite bound yields no ticks.
 */
export function linearTicks(
  domain: readonly [number, number],
  targetCount = 5,
): number[] {
  let [lo, hi] = domain;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) return [lo];
  if (lo > hi) [lo, hi] = [hi, lo];
  const step = tickStep(lo, hi, targetCount);
  const out: number[] = [];
  // The epsilon keeps a top bound that *is* a lattice point (e.g. 10 with
  // step 2) from being dropped to accumulated float error.
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(snapToStep(v, step));
  }
  return out;
}

/** A chosen tick scale: the values to rule and label, and how many decimals
 *  a label may print. */
export type NiceTicks = {
  values: number[];
  /** The winning step's own precision — a tick never prints a digit finer
   *  than the interval it marks. */
  decimals: number;
};

/**
 * Tick values for a linear domain under a *cap* on how many there may be,
 * together with the precision their labels should print at.
 *
 * The sibling of `linearTicks`, and the difference is which side of the count
 * is fixed. `linearTicks` aims at a target and lands near it; this takes a
 * ceiling and returns the densest 1/2/5-stepped scale that fits under it, so
 * a plot with room for four gridlines gets four rather than "about five".
 * That is the shape an axis wants when the number of lines is decided by the
 * pixels available rather than by taste.
 *
 * The other half is `decimals`. Multiplying an index by a fractional step is
 * where 36.5 becomes 36.500000000000004, and a caller that has to work the
 * rounding out for itself is a caller that will get it wrong somewhere: the
 * step's own precision is exactly the digits that survive, so it is returned
 * with the values rather than left to be re-derived.
 *
 * Only ticks *inside* the domain are returned — a label above the top of the
 * plot is a number the chart does not draw. A degenerate domain (no data, or
 * every value identical) has no scale worth labelling and yields none.
 */
export function niceTicks(
  domain: readonly [number, number],
  maxCount: number,
): NiceTicks {
  let [lo, hi] = domain;
  if (lo > hi) [lo, hi] = [hi, lo];
  const span = hi - lo;
  if (!Number.isFinite(span) || span <= 0 || maxCount < 1) {
    return { values: [], decimals: 0 };
  }

  // From well under the span up to well over it. The last candidates span the
  // whole domain several times over and so cannot yield more than one line,
  // which is what guarantees the search ends.
  const from = Math.floor(Math.log10(span)) - 1;
  for (let exponent = from; exponent <= from + 5; exponent++) {
    for (const mantissa of [1, 2, 5]) {
      const step = mantissa * 10 ** exponent;
      // The epsilons are against floating point, not against the data: a tick
      // landing exactly on an end must not be dropped because the division
      // left it a billionth outside.
      const first = Math.ceil(lo / step - 1e-9);
      const last = Math.floor(hi / step + 1e-9);
      if (last - first + 1 > maxCount) continue;
      const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
      const values: number[] = [];
      for (let i = first; i <= last; i++) {
        values.push(Number((i * step).toFixed(decimals)));
      }
      return { values, decimals };
    }
  }
  return { values: [], decimals: 0 };
}

/** Linear domain→range scale. A zero-span domain maps to the range midpoint. */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
  options: LinearScaleOptions = {},
): Scale {
  let [d0, d1] = domain;
  if (options.nice && d0 !== d1) {
    const step = tickStep(Math.min(d0, d1), Math.max(d0, d1), 5);
    const lo = Math.floor(Math.min(d0, d1) / step) * step;
    const hi = Math.ceil(Math.max(d0, d1) / step) * step;
    [d0, d1] = d0 <= d1 ? [lo, hi] : [hi, lo];
  }
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((v: number): number => {
    if (span === 0) return (r0 + r1) / 2;
    let t = (v - d0) / span;
    if (options.clamp) t = Math.min(1, Math.max(0, t));
    return r0 + t * (r1 - r0);
  }) as Scale;
  scale.domain = [d0, d1];
  scale.range = [r0, r1];
  return scale;
}

/** Time domain→range scale (linear over the epoch milliseconds). */
export function timeScale(
  domain: readonly [Date, Date],
  range: readonly [number, number],
): TimeScale {
  const inner = linearScale([domain[0].getTime(), domain[1].getTime()], range);
  const scale = ((d: Date): number => inner(d.getTime())) as TimeScale;
  scale.domain = [domain[0], domain[1]];
  scale.range = [range[0], range[1]];
  return scale;
}

/** The calendar unit a time tick sequence steps in. */
export type TimeTickUnit = "hour" | "day" | "week" | "month" | "year";

export type TimeTick = { value: Date; unit: TimeTickUnit };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// The candidate (unit, step) ladder, in increasing interval size. Month and
// year intervals are approximations only used to *choose* a rung; the actual
// tick dates are generated by calendar walking, so they stay boundary-exact.
const TIME_LADDER: readonly {
  unit: TimeTickUnit;
  step: number;
  approxMs: number;
}[] = [
  { unit: "hour", step: 1, approxMs: HOUR_MS },
  { unit: "hour", step: 3, approxMs: 3 * HOUR_MS },
  { unit: "hour", step: 6, approxMs: 6 * HOUR_MS },
  { unit: "hour", step: 12, approxMs: 12 * HOUR_MS },
  { unit: "day", step: 1, approxMs: DAY_MS },
  { unit: "day", step: 2, approxMs: 2 * DAY_MS },
  { unit: "week", step: 1, approxMs: 7 * DAY_MS },
  { unit: "week", step: 2, approxMs: 14 * DAY_MS },
  { unit: "month", step: 1, approxMs: 30 * DAY_MS },
  { unit: "month", step: 3, approxMs: 91 * DAY_MS },
  { unit: "month", step: 6, approxMs: 182 * DAY_MS },
  { unit: "year", step: 1, approxMs: 365 * DAY_MS },
];

/**
 * Calendar-aligned tick dates for a time domain, aimed at ~`targetCount`
 * ticks. Picks the smallest (unit, step) rung whose interval keeps the count
 * at or under target (falling back to N-year steps for very wide domains),
 * then walks real calendar boundaries — local midnight for days, the 1st for
 * months, Jan 1 for years — so ticks stay correct across DST and month
 * length, never `start + k·ms`.
 */
export function timeTicks(
  domain: readonly [Date, Date],
  targetCount = 5,
): TimeTick[] {
  const lo = Math.min(domain[0].getTime(), domain[1].getTime());
  const hi = Math.max(domain[0].getTime(), domain[1].getTime());
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) return [{ value: new Date(lo), unit: "day" }];
  const target = (hi - lo) / Math.max(1, targetCount);

  // Wider than every ladder rung: step whole years on a 1/2/5 lattice.
  const rung: { unit: TimeTickUnit; step: number } = TIME_LADDER.find(
    (r) => r.approxMs >= target,
  ) ?? {
    unit: "year",
    step: Math.max(1, tickStep(0, (hi - lo) / (365 * DAY_MS), targetCount)),
  };

  const out: TimeTick[] = [];
  const push = (d: Date) => {
    const t = d.getTime();
    if (t >= lo && t <= hi) out.push({ value: d, unit: rung.unit });
  };

  const start = new Date(lo);
  if (rung.unit === "hour") {
    const first = new Date(start);
    first.setMinutes(0, 0, 0);
    while (first.getTime() < lo || first.getHours() % rung.step !== 0) {
      first.setHours(first.getHours() + 1);
    }
    for (
      const d = first;
      d.getTime() <= hi;
      d.setHours(d.getHours() + rung.step)
    ) {
      push(new Date(d));
    }
  } else if (rung.unit === "day" || rung.unit === "week") {
    const stepDays = rung.unit === "week" ? 7 * rung.step : rung.step;
    const first = new Date(start);
    first.setHours(0, 0, 0, 0);
    if (rung.unit === "week") {
      // Align to Monday (ISO week start).
      while (first.getDay() !== 1) first.setDate(first.getDate() + 1);
    }
    while (first.getTime() < lo) first.setDate(first.getDate() + stepDays);
    for (
      const d = first;
      d.getTime() <= hi;
      d.setDate(d.getDate() + stepDays)
    ) {
      push(new Date(d));
    }
  } else if (rung.unit === "month") {
    const first = new Date(start.getFullYear(), start.getMonth(), 1);
    while (first.getTime() < lo || first.getMonth() % rung.step !== 0) {
      first.setMonth(first.getMonth() + 1);
    }
    for (
      const d = first;
      d.getTime() <= hi;
      d.setMonth(d.getMonth() + rung.step)
    ) {
      push(new Date(d));
    }
  } else {
    const first = new Date(start.getFullYear(), 0, 1);
    while (first.getTime() < lo || first.getFullYear() % rung.step !== 0) {
      first.setFullYear(first.getFullYear() + 1);
    }
    for (
      const d = first;
      d.getTime() <= hi;
      d.setFullYear(d.getFullYear() + rung.step)
    ) {
      push(new Date(d));
    }
  }
  return out;
}

export type BandScaleOptions = {
  /** Fraction of each band left as a gap between neighbours (0–1). */
  paddingInner?: number;
  /** Fraction of one band left open at each end of the range (0–1). */
  paddingOuter?: number;
};

export type BandScale = {
  /** Leading edge (range position) of band `i`. */
  position(i: number): number;
  /** Width of every band. */
  bandwidth: number;
};

/**
 * Evenly spaced bands for `count` categories across a pixel range — the
 * category axis of a bar chart. Bands never overlap; padding is expressed as
 * a fraction of the band step, mirroring the d3 convention.
 */
export function bandScale(
  count: number,
  range: readonly [number, number],
  options: BandScaleOptions = {},
): BandScale {
  const paddingInner = Math.min(1, Math.max(0, options.paddingInner ?? 0.2));
  const paddingOuter = Math.max(0, options.paddingOuter ?? 0.1);
  const [r0, r1] = range;
  const span = r1 - r0;
  const n = Math.max(0, count);
  // n bands + (n-1) inner gaps + 2 outer gaps, all in units of one step.
  const steps = n - paddingInner + 2 * paddingOuter;
  const step = n > 0 && steps > 0 ? span / steps : 0;
  const bandwidth = Math.max(0, step * (1 - paddingInner));
  return {
    position: (i: number) => r0 + step * (paddingOuter + i),
    bandwidth,
  };
}
