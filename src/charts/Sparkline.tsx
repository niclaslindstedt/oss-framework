// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { linePath, type PathPoint } from "./path.ts";
import { linearScale } from "./scale.ts";

// An axis-free inline trend mark — the word-sized chart that sits beside a
// row label or in a stat tile. No axes, no grid, no legend: just the line
// (and optionally a dot on the latest value). Decorative by default: without
// an `ariaLabel` it is `aria-hidden`, so a column of sparklines doesn't read
// as a wall of unlabeled images; pass a label to make one meaningful.
//
// The y domain is the data's own min–max (a sparkline shows *shape*, not
// magnitude — the honest-baseline rule belongs to axed charts), padded by the
// stroke width so extremes never clip.

type Props = {
  /** The series to draw; `null` values are gaps. */
  values: readonly (number | null)[];
  width?: number;
  height?: number;
  /** CSS colour of the stroke. Default: the theme accent. */
  color?: string;
  strokeWidth?: number;
  /** Mark the most recent value with a filled dot. */
  showLastDot?: boolean;
  /** Present when the sparkline is informative; absent = decorative. */
  ariaLabel?: string;
  className?: string;
};

export function Sparkline({
  values,
  width = 80,
  height = 24,
  color = "var(--accent)",
  strokeWidth = 2,
  showLastDot = false,
  ariaLabel,
  className = "",
}: Props) {
  const finite = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const pad = strokeWidth;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (finite.length === 0) {
    min = 0;
    max = 1;
  }
  const x = linearScale(
    [0, Math.max(1, values.length - 1)],
    [pad, width - pad],
  );
  const y = linearScale([min, max], [height - pad, pad]);

  const points: PathPoint[] = values.map((v, i) =>
    v == null || !Number.isFinite(v) ? null : [x(i), y(v)],
  );
  const d = linePath(points);

  // The most recent plotted value — the dot's anchor when requested.
  let last: [number, number] | null = null;
  for (let i = points.length - 1; i >= 0 && !last; i--) {
    if (points[i]) last = points[i] as [number, number];
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={`shrink-0 ${className}`.trim()}
    >
      {d && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {showLastDot && last && (
        <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} fill={color} />
      )}
    </svg>
  );
}
