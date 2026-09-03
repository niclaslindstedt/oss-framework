// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public chart surface. Zero-dependency SVG charts over a pure, DOM-free
// core: scales and ticks (`scale.ts`), stacking (`stack.ts`), path
// construction (`path.ts`), and donut arcs (`arc.ts`) are all exported on
// their own, so an app can project custom marks through the same math the
// shipped components use.
export {
  linearScale,
  linearTicks,
  niceTicks,
  type NiceTicks,
  timeScale,
  timeTicks,
  bandScale,
  type Scale,
  type TimeScale,
  type LinearScaleOptions,
  type TimeTick,
  type TimeTickUnit,
  type BandScale,
  type BandScaleOptions,
} from "./scale.ts";
export {
  stackSeries,
  stackedExtent,
  seriesExtent,
  type StackedExtent,
} from "./stack.ts";
export {
  linePath,
  areaPath,
  bandPath,
  barPath,
  type PathPoint,
  type CurveKind,
  type LinePathOptions,
} from "./path.ts";
export { donutArcs, type DonutArc, type DonutArcOptions } from "./arc.ts";
export {
  SERIES_COLOR_TOKENS,
  seriesColor,
  formatChartValue,
  type Series,
  type LegendEntry,
} from "./common.tsx";
export { Sparkline } from "./Sparkline.tsx";
export { LineChart } from "./LineChart.tsx";
export { BarChart } from "./BarChart.tsx";
export { DonutChart, type DonutSegment } from "./DonutChart.tsx";
