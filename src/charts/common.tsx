// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared chart vocabulary: the series shape every multi-series chart takes,
// the theme-token colour order, the default value formatter, and the legend.
//
// Series colours are the theme's accent slots in a **fixed order** — colour
// is assigned by series position and follows that series everywhere, so a
// theme change restyles every chart and no chart invents its own palette.
// The order was validated for colour-vision-deficiency separation between
// neighbours against the default dark and light presets. Six slots is the
// deliberate ceiling: a seventh series is the caller's cue to aggregate
// ("other"), split charts, or pass explicit `color`s — the tokens do not
// cycle into repeats meaningfully beyond the vocabulary the theme defines.

import type { ReactNode } from "react";

/** One plotted series. `null` values are gaps, not zeroes. */
export type Series = {
  values: readonly (number | null)[];
  /** Legend / tooltip name. Charts with ≥ 2 series render a legend from it. */
  label?: string;
  /** Explicit CSS colour; default is the theme-token order by position. */
  color?: string;
};

/** The series colour order — theme accent slots, fixed, never re-ranked. */
export const SERIES_COLOR_TOKENS: readonly string[] = [
  "var(--accent)",
  "var(--link)",
  "var(--flag)",
  "var(--path)",
  "var(--pipe)",
  "var(--meta)",
];

/** Colour for series `index`, honouring an explicit override. */
export function seriesColor(index: number, override?: string): string {
  return (
    override ??
    SERIES_COLOR_TOKENS[index % SERIES_COLOR_TOKENS.length] ??
    "var(--accent)"
  );
}

// One lazily-built formatter — Intl instances are expensive to construct and
// every default tick/value label funnels through this.
let numberFormat: Intl.NumberFormat | undefined;

/**
 * Default value/tick formatter: the browser locale's plain number formatting
 * capped at two fraction digits. Charts accept `formatValue` / `formatTick`
 * overrides for anything richer (units, currency, compact notation).
 */
export function formatChartValue(value: number): string {
  numberFormat ??= new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  return numberFormat.format(value);
}

export type LegendEntry = { label: string; color: string };

/**
 * The swatch-and-label legend row rendered under a chart whenever two or
 * more series are named — identity is never carried by colour alone. Text
 * wears the muted text token, never the series colour; the swatch beside it
 * carries the hue.
 */
export function ChartLegend({
  entries,
}: {
  entries: readonly LegendEntry[];
}): ReactNode {
  if (entries.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {entries.map((entry, i) => (
        <span
          key={`${entry.label}-${i}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: entry.color }}
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

/** Font size (px) of tick/category labels — small and recessive by design. */
export const TICK_FONT_SIZE = 10;

/** Rough per-character width (px) at the tick font size, for margin sizing. */
export const TICK_CHAR_WIDTH = 6;

/** Pixel width to reserve left of the plot for the widest y tick label. */
export function tickLabelGutter(labels: readonly string[]): number {
  const chars = labels.reduce((max, l) => Math.max(max, l.length), 0);
  return Math.min(96, chars * TICK_CHAR_WIDTH + 10);
}
