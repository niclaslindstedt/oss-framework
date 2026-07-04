// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMeasuredSize } from "../hooks/useMeasuredSize.ts";
import {
  ChartLegend,
  formatChartValue,
  seriesColor,
  tickLabelGutter,
  TICK_FONT_SIZE,
  type LegendEntry,
  type Series,
} from "./common.tsx";
import {
  areaPath,
  bandPath,
  linePath,
  type CurveKind,
  type PathPoint,
} from "./path.ts";
import { linearScale, linearTicks, timeScale, timeTicks } from "./scale.ts";
import { stackSeries, stackedExtent } from "./stack.ts";

// Change-over-time (or over an ordered category) as lines: one `<path>` per
// series, an optional area fill, optional stacking (rendered as stacked
// areas — each layer fills from the layer below). One value axis, always —
// two measures of different scale are two charts, never a second y axis.
//
// The x axis is either evenly spaced `labels` or real `timestamps` (ticks
// then fall on calendar boundaries). `null` values are gaps: the stroke
// breaks rather than bridging, and a point stranded between gaps renders as
// a dot so it doesn't vanish. Grid and tick text stay recessive (line/muted
// tokens); series colours follow the fixed theme-token order; ≥ 2 labelled
// series always get a legend.
//
// Width tracks the container by default (ResizeObserver); pass `width` to
// fix it. The SVG is `role="img"` behind the required `ariaLabel` — the
// chart reads as one image, with `desc` for the longer story.

type Props = {
  series: readonly Series[];
  /** X positions: evenly spaced labels, or real timestamps (pick one). */
  x?: {
    labels?: readonly string[];
    timestamps?: readonly Date[];
  };
  /** Fixed plot width; default fills the container. */
  width?: number;
  height?: number;
  /** Fill under each line (unstacked) — implied when `stacked`. */
  area?: boolean;
  /** Stack the series (rendered as stacked areas over a shared baseline). */
  stacked?: boolean;
  /** Dot every point (with a native value tooltip). */
  showDots?: boolean;
  curve?: CurveKind;
  tickCount?: number;
  /** Formats y tick labels and dot tooltips. */
  formatValue?: (value: number) => string;
  /** Formats x tick labels (a category label or a tick's `Date`). */
  formatTick?: (tick: string | Date) => string;
  /** Required alt text: what this chart shows. */
  ariaLabel: string;
  /** Longer description, rendered as the SVG `<desc>`. */
  desc?: string;
  className?: string;
};

const MARGIN = { top: 8, right: 8, bottom: 18 };

// Per-unit date-label formatters, built once — hour ticks read "14:00",
// day/week ticks "Jul 4", month ticks "Jul", year ticks "2026".
const timeTickFormats: Partial<Record<string, Intl.DateTimeFormat>> = {};
function formatTimeTick(value: Date, unit: string): string {
  const options: Intl.DateTimeFormatOptions =
    unit === "hour"
      ? { hour: "2-digit", minute: "2-digit" }
      : unit === "month"
        ? { month: "short" }
        : unit === "year"
          ? { year: "numeric" }
          : { month: "short", day: "numeric" };
  timeTickFormats[unit] ??= new Intl.DateTimeFormat(undefined, options);
  return timeTickFormats[unit]!.format(value);
}

// Thin a crowded label axis to at most `maxTicks` evenly spaced entries.
function sparseIndices(count: number, maxTicks: number): number[] {
  const step = Math.max(1, Math.ceil(count / maxTicks));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  return out;
}

export function LineChart({
  series,
  x,
  width,
  height = 180,
  area = false,
  stacked = false,
  showDots = false,
  curve = "linear",
  tickCount = 4,
  formatValue = formatChartValue,
  formatTick,
  ariaLabel,
  desc,
  className = "",
}: Props) {
  const { ref, size } = useMeasuredSize<HTMLDivElement>();
  const plotWidth = width ?? size?.width ?? null;

  const pointCount = series.reduce(
    (max, s) => Math.max(max, s.values.length),
    0,
  );
  const stack = stacked ? stackSeries(series.map((s) => s.values)) : null;

  // Y domain: a stack always spans its full extent from the shared baseline;
  // plain lines use the data's own extent (an area keeps the honest 0
  // baseline); degenerate input still yields a drawable domain.
  let lo = Infinity;
  let hi = -Infinity;
  if (stack) {
    [lo, hi] = stackedExtent(stack);
  } else {
    for (const s of series) {
      for (const v of s.values) {
        if (v == null || !Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (lo === Infinity) [lo, hi] = [0, 1];
    if (area) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  }

  const yDomain: readonly [number, number] = [lo, hi];
  const yTickValues = linearTicks(yDomain, tickCount);
  const yTickLabels = yTickValues.map(formatValue);
  const marginLeft = tickLabelGutter(yTickLabels);

  const legend: LegendEntry[] = series
    .map((s, i) => ({ label: s.label, color: seriesColor(i, s.color) }))
    .filter((e): e is LegendEntry => e.label != null);

  const body = (plotW: number) => {
    const innerRight = plotW - MARGIN.right;
    const plotBottom = height - MARGIN.bottom;
    const yScale = linearScale(yDomain, [plotBottom, MARGIN.top], {
      nice: true,
    });
    // Integer data (counts) never labels fractional ticks — "0.4 items" is
    // not a thing. Fractional ticks stay for genuinely fractional data.
    const allInteger = series.every((s) =>
      s.values.every((v) => v == null || Number.isInteger(v)),
    );
    const yTicks = linearTicks(yScale.domain, tickCount).filter(
      (t) => !allInteger || Number.isInteger(t),
    );

    const timestamps = x?.timestamps;
    const labels = x?.labels;
    const xPositions: number[] = [];
    let xTicks: { pos: number; text: string }[] = [];
    const firstStamp = timestamps?.[0];
    if (timestamps && firstStamp) {
      const lastStamp = timestamps[timestamps.length - 1] ?? firstStamp;
      const tScale = timeScale(
        [firstStamp, lastStamp],
        [marginLeft, innerRight],
      );
      for (const t of timestamps) xPositions.push(tScale(t));
      xTicks = timeTicks(tScale.domain, 5).map((tick) => ({
        pos: tScale(tick.value),
        text: formatTick
          ? formatTick(tick.value)
          : formatTimeTick(tick.value, tick.unit),
      }));
    } else {
      const span = innerRight - marginLeft;
      const denom = Math.max(1, pointCount - 1);
      for (let i = 0; i < pointCount; i++) {
        xPositions.push(marginLeft + (i / denom) * span);
      }
      if (labels && labels.length > 0) {
        xTicks = sparseIndices(labels.length, 6).map((i) => {
          const label = labels[i] ?? "";
          return {
            pos: xPositions[i] ?? marginLeft,
            text: formatTick ? formatTick(label) : label,
          };
        });
      }
    }

    const project = (values: readonly (number | null)[]): PathPoint[] =>
      values.map((v, i) =>
        v == null || !Number.isFinite(v) || xPositions[i] == null
          ? null
          : [xPositions[i], yScale(v)],
      );

    const baseline = yScale(
      Math.max(yScale.domain[0], Math.min(0, yScale.domain[1])),
    );

    return (
      <svg
        width={plotW}
        height={height}
        viewBox={`0 0 ${plotW} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        {desc && <desc>{desc}</desc>}
        {/* Recessive horizontal grid, one line per y tick. */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={marginLeft}
              x2={innerRight}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={marginLeft - 6}
              y={yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={TICK_FONT_SIZE}
              fill="var(--muted)"
            >
              {formatValue(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={`x-${i}`}
            x={t.pos}
            y={height - 5}
            textAnchor="middle"
            fontSize={TICK_FONT_SIZE}
            fill="var(--muted)"
          >
            {t.text}
          </text>
        ))}
        {series.map((s, si) => {
          const color = seriesColor(si, s.color);
          if (stack) {
            const layer = stack[si];
            if (!layer) return null;
            const top = project(layer.map((e) => e.y1));
            const bottom = project(layer.map((e) => e.y0));
            const fill = bandPath(top, bottom, { curve });
            const edge = linePath(top, { curve });
            return (
              <g key={si}>
                {fill && <path d={fill} fill={color} fillOpacity={0.3} />}
                {edge && (
                  <path
                    d={edge}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            );
          }
          const points = project(s.values);
          const d = linePath(points, { curve });
          // A point stranded between gaps has no stroke — surface it as a dot.
          const stranded = points.filter(
            (p, i) =>
              p != null && points[i - 1] == null && points[i + 1] == null,
          ) as [number, number][];
          return (
            <g key={si}>
              {area && d && (
                <path
                  d={areaPath(points, baseline, { curve })}
                  fill={color}
                  fillOpacity={0.15}
                />
              )}
              {d && (
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {(showDots
                ? (points.filter(Boolean) as [number, number][])
                : stranded
              ).map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={2.5}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div ref={width == null ? ref : undefined} className={className}>
      {plotWidth != null && plotWidth > marginLeft + MARGIN.right
        ? body(plotWidth)
        : // Reserve the height while the container is still measuring so the
          // layout doesn't jump when the chart lands.
          width == null && <div style={{ height }} />}
      <ChartLegend entries={legend} />
    </div>
  );
}
