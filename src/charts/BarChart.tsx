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
import { barPath } from "./path.ts";
import { bandScale, linearScale, linearTicks } from "./scale.ts";
import { stackSeries, stackedExtent, seriesExtent } from "./stack.ts";

// Magnitude by category as bars — grouped side by side, or stacked. The
// value axis always includes 0 (a bar's length *is* its value; no truncated
// baselines), and there is only ever the one value axis. `horizontal` flips
// the layout for long category names.
//
// Mark spec: thin bars from the band scale's padding; a grouped bar's value
// end is rounded (4px, anchored to the baseline); stacked segments stay
// square with a 2px surface gap between fills, so neighbours never read as
// one mass on any theme. Series colours follow the fixed theme-token order,
// ≥ 2 labelled series get a legend, and every bar carries a native
// `<title>` value tooltip. The SVG is `role="img"` behind the required
// `ariaLabel`.

type Props = {
  series: readonly Series[];
  /** One category name per index; drawn along the category axis. */
  labels: readonly string[];
  stacked?: boolean;
  /** Bars run left→right and categories stack top→bottom. */
  horizontal?: boolean;
  /** Fixed plot width; default fills the container. */
  width?: number;
  /** Default: 180, or grows with the category count when `horizontal`. */
  height?: number;
  tickCount?: number;
  /** Formats value tick labels and bar tooltips. */
  formatValue?: (value: number) => string;
  /** Required alt text: what this chart shows. */
  ariaLabel: string;
  /** Longer description, rendered as the SVG `<desc>`. */
  desc?: string;
  className?: string;
};

const MARGIN = { top: 8, right: 8, bottom: 18 };
const ROUND = 4;
const STACK_GAP = 2;
const GROUP_GAP = 2;

type Bar = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The rounded value end, or null for a square (stacked) segment. */
  round: "top" | "bottom" | "left" | "right" | null;
  color: string;
  title: string;
};

export function BarChart({
  series,
  labels,
  stacked = false,
  horizontal = false,
  width,
  height,
  tickCount = 4,
  formatValue = formatChartValue,
  ariaLabel,
  desc,
  className = "",
}: Props) {
  const { ref, size } = useMeasuredSize<HTMLDivElement>();
  const plotWidth = width ?? size?.width ?? null;

  const values = series.map((s) => s.values);
  const stack = stacked ? stackSeries(values) : null;
  const domain = stack ? stackedExtent(stack) : seriesExtent(values);
  const valueTickLabels = linearTicks(domain, tickCount).map(formatValue);

  // Gutter left of the plot: category names when horizontal, value tick
  // labels when vertical.
  const marginLeft = horizontal
    ? tickLabelGutter(labels)
    : tickLabelGutter(valueTickLabels);

  const rowHeight =
    stacked || series.length === 1 ? 26 : series.length * 16 + 12;
  const plotHeight =
    height ??
    (horizontal
      ? Math.max(60, labels.length * rowHeight + MARGIN.top + MARGIN.bottom)
      : 180);

  const legend: LegendEntry[] = series
    .map((s, i) => ({ label: s.label, color: seriesColor(i, s.color) }))
    .filter((e): e is LegendEntry => e.label != null);

  const body = (plotW: number) => {
    const innerRight = plotW - MARGIN.right;
    const plotBottom = plotHeight - MARGIN.bottom;

    const valueRange: readonly [number, number] = horizontal
      ? [marginLeft, innerRight]
      : [plotBottom, MARGIN.top];
    const value = linearScale(domain, valueRange, { nice: true });
    // Integer data (counts) never labels fractional ticks — "0.4 items" is
    // not a thing. Fractional ticks stay for genuinely fractional data.
    const allInteger = series.every((s) =>
      s.values.every((v) => v == null || Number.isInteger(v)),
    );
    const valueTicks = linearTicks(value.domain, tickCount).filter(
      (t) => !allInteger || Number.isInteger(t),
    );
    const zero = value(Math.max(value.domain[0], Math.min(0, value.domain[1])));

    const band = bandScale(
      labels.length,
      horizontal ? [MARGIN.top, plotBottom] : [marginLeft, innerRight],
    );

    // For stacked columns, the outermost segment of each sign keeps its full
    // extent; inner segments give up a 2px gap at their value end.
    const outerOfSign = (ci: number, sign: 1 | -1): number => {
      for (let si = series.length - 1; si >= 0; si--) {
        const v = values[si]?.[ci];
        if (
          v != null &&
          Number.isFinite(v) &&
          v !== 0 &&
          Math.sign(v) === sign
        ) {
          return si;
        }
      }
      return -1;
    };

    const bars: Bar[] = [];
    for (let ci = 0; ci < labels.length; ci++) {
      const bandStart = band.position(ci);
      for (let si = 0; si < series.length; si++) {
        const oneSeries = series[si];
        const v = values[si]?.[ci];
        if (!oneSeries || v == null || !Number.isFinite(v)) continue;
        const color = seriesColor(si, oneSeries.color);
        const title = `${oneSeries.label ? `${oneSeries.label} · ` : ""}${
          labels[ci] ?? ""
        }: ${formatValue(v)}`;

        // Thickness and offset across the band (shared by both orientations).
        let thick = band.bandwidth;
        let offset = bandStart;
        if (!stacked && series.length > 1) {
          thick = Math.max(
            1,
            (band.bandwidth - GROUP_GAP * (series.length - 1)) / series.length,
          );
          offset = bandStart + si * (thick + GROUP_GAP);
        }

        // Extent along the value axis.
        let from: number;
        let to: number;
        if (stack) {
          const extent = stack[si]?.[ci];
          if (!extent) continue;
          from = value(extent.y0);
          to = value(extent.y1);
          if (v !== 0 && si !== outerOfSign(ci, Math.sign(v) as 1 | -1)) {
            // Shave the value end to open the gap toward the next segment —
            // but never below a 1px sliver, so thin layers stay visible.
            const dir = to >= from ? 1 : -1;
            const len = Math.abs(to - from);
            const gap = Math.min(STACK_GAP, Math.max(0, len - 1));
            to = from + dir * (len - gap);
          }
        } else {
          from = zero;
          to = value(v);
        }

        const lo = Math.min(from, to);
        const len = Math.abs(to - from);
        if (len === 0) continue;
        const round = stack
          ? null
          : horizontal
            ? v >= 0
              ? ("right" as const)
              : ("left" as const)
            : v >= 0
              ? ("top" as const)
              : ("bottom" as const);
        bars.push(
          horizontal
            ? { x: lo, y: offset, w: len, h: thick, round, color, title }
            : { x: offset, y: lo, w: thick, h: len, round, color, title },
        );
      }
    }

    return (
      <svg
        width={plotW}
        height={plotHeight}
        viewBox={`0 0 ${plotW} ${plotHeight}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        {desc && <desc>{desc}</desc>}
        {/* Recessive grid + tick labels along the value axis. */}
        {valueTicks.map((t) => (
          <g key={`v-${t}`}>
            <line
              x1={horizontal ? value(t) : marginLeft}
              x2={horizontal ? value(t) : innerRight}
              y1={horizontal ? MARGIN.top : value(t)}
              y2={horizontal ? plotBottom : value(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={horizontal ? value(t) : marginLeft - 6}
              y={horizontal ? plotHeight - 5 : value(t)}
              textAnchor={horizontal ? "middle" : "end"}
              dominantBaseline={horizontal ? undefined : "middle"}
              fontSize={TICK_FONT_SIZE}
              fill="var(--muted)"
            >
              {formatValue(t)}
            </text>
          </g>
        ))}
        {/* Category labels along the band axis. */}
        {labels.map((label, i) => {
          const centre = band.position(i) + band.bandwidth / 2;
          return horizontal ? (
            <text
              key={`c-${i}`}
              x={marginLeft - 6}
              y={centre}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={TICK_FONT_SIZE}
              fill="var(--muted)"
            >
              {label}
            </text>
          ) : (
            <text
              key={`c-${i}`}
              x={centre}
              y={plotHeight - 5}
              textAnchor="middle"
              fontSize={TICK_FONT_SIZE}
              fill="var(--muted)"
            >
              {label}
            </text>
          );
        })}
        {bars.map((bar, i) => (
          <path
            key={i}
            d={
              bar.round
                ? barPath(bar.x, bar.y, bar.w, bar.h, ROUND, bar.round)
                : barPath(bar.x, bar.y, bar.w, bar.h, 0)
            }
            fill={bar.color}
          >
            <title>{bar.title}</title>
          </path>
        ))}
      </svg>
    );
  };

  return (
    <div ref={width == null ? ref : undefined} className={className}>
      {plotWidth != null && plotWidth > marginLeft + MARGIN.right
        ? body(plotWidth)
        : width == null && <div style={{ height: plotHeight }} />}
      <ChartLegend entries={legend} />
    </div>
  );
}
