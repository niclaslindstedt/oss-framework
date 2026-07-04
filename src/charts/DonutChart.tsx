// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { donutArcs } from "./arc.ts";
import {
  ChartLegend,
  formatChartValue,
  seriesColor,
  type LegendEntry,
} from "./common.tsx";

// A part-of-whole ring. Segments take the theme-token colour order by
// position (override per segment with `color`); a 2px surface-coloured
// stroke keeps neighbouring fills visibly separated on every theme, and any
// labelled chart with ≥ 2 segments also gets a legend, so identity never
// rides on colour alone. `innerLabel` renders centred in the hole — the
// natural home for the headline total.
//
// The SVG is `role="img"` behind the required `ariaLabel`; per-segment
// `<title>` elements give pointer users a native value tooltip.

export type DonutSegment = {
  /** Non-negative share; zero (or negative) renders nothing for the slot. */
  value: number;
  /** Legend / tooltip name for the segment. */
  label?: string;
  /** Explicit CSS colour; default is the theme-token order by position. */
  color?: string;
};

type Props = {
  segments: readonly DonutSegment[];
  /** Outer diameter in pixels. */
  size?: number;
  /** Ring thickness in pixels. Default: 22% of the diameter. */
  thickness?: number;
  /** Centred in the hole — a headline total, a stat, any node. */
  innerLabel?: ReactNode;
  /** Formats each segment's value in its tooltip. */
  formatValue?: (value: number) => string;
  /** Required alt text: what this ring shows. */
  ariaLabel: string;
  /** Longer description, rendered as the SVG `<desc>`. */
  desc?: string;
  className?: string;
};

export function DonutChart({
  segments,
  size = 160,
  thickness,
  innerLabel,
  formatValue = formatChartValue,
  ariaLabel,
  desc,
  className = "",
}: Props) {
  const radius = size / 2;
  const ringWidth = thickness ?? Math.max(8, size * 0.22);
  const arcs = donutArcs(
    segments.map((s) => s.value),
    { radius, innerRadius: Math.max(0, radius - ringWidth) },
  );
  const total = segments.reduce(
    (sum, s) => sum + (Number.isFinite(s.value) && s.value > 0 ? s.value : 0),
    0,
  );

  const legend: LegendEntry[] = segments
    .map((s, i) => ({ label: s.label, color: seriesColor(i, s.color) }))
    .filter((e): e is LegendEntry => e.label != null);

  return (
    <div className={className}>
      <div className="relative inline-block" style={{ width: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`${-radius} ${-radius} ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
        >
          {desc && <desc>{desc}</desc>}
          {arcs.map((arc, i) => {
            const segment = segments[i];
            if (!segment || !arc.d) return null;
            return (
              <path
                key={i}
                d={arc.d}
                fill={seriesColor(i, segment.color)}
                fillRule="evenodd"
                stroke="var(--surface)"
                strokeWidth={2}
              >
                <title>
                  {`${segment.label ?? ""}${segment.label ? ": " : ""}${formatValue(
                    segment.value,
                  )}${total > 0 ? ` (${Math.round(arc.fraction * 100)}%)` : ""}`}
                </title>
              </path>
            );
          })}
        </svg>
        {innerLabel != null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-fg">
            {innerLabel}
          </div>
        )}
      </div>
      <ChartLegend entries={legend} />
    </div>
  );
}
