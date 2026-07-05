<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Expansion roadmap

The single source of truth for **net-new capability modules** — the surface the
framework does not cover yet, planned module by module so any session can pick
up the next tranche and land it as one reviewable PR. Worked via the
`expand-framework` skill ("expand the framework"), which picks the next
Pending row, implements it under the rules below, and flips the row to
Landed. Where the
[refactoring roadmap](./refactoring-roadmap.md) improves components already
extracted, this roadmap grows the set of app kinds the framework can carry:
today it serves list/notes-shaped PWAs well; it cannot yet serve an app that
needs data visualization, date UI, media viewing, drawing, or math.

Every module here obeys the standing rules — they are what make an entry
belong to the framework at all:

- **Zero runtime dependencies.** Pure React + Web APIs (SVG, Canvas, `Intl`,
  pointer events). No charting/date/canvas libraries.
- **No domain naming** (see `AGENTS.md`). The framework ships the _mechanism_;
  the app supplies the vocabulary. Hence `expression`, not calculator;
  `viewer`, not photo gallery; `draw`, not paint.
- **Pure core + thin components.** Each module keeps a DOM-free logic core
  (like `checklist/tree.ts`, `search/matcher.ts`) with components layered on
  top, so behaviour is unit-testable without a browser.
- **Theme tokens + injected labels.** Styling through the existing slot
  variables only; every visible string is a `labels` prop with English
  defaults.
- **The wiring checklist** for a new subpath: module barrel →
  `src/index.ts` → `tsup.config.ts` entry → `package.json` `exports` →
  `demo/vite.config.ts` alias → tests in `tests/` → a demo showcase →
  a `.changes/unreleased/` fragment → README API row.

## Status

| #   | Module / item              | Subpath              | Size | Priority     | Status                                                                                                                        |
| --- | -------------------------- | -------------------- | ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Charts                     | `charts`             | L    | High         | **Landed** (this roadmap's first tranche)                                                                                     |
| 2   | Toast stack                | `components`         | S    | High         | **Landed** (contacts consolidation)                                                                                           |
| 3   | Tabs primitive             | `components`         | S    | High         | Pending                                                                                                                       |
| 4   | `format` — `Intl` wrappers | `format`             | S    | High (infra) | Partial — subpath landed with URL/digit/byte helpers; the `Intl` date/number wrapper set is still pending                     |
| 5   | Calendar                   | `calendar`           | M/L  | High         | Partial — subpath landed with recurring-date math + `.ics` serialization; `MonthGrid`/`DatePicker` still pending              |
| 6   | Media viewer               | `viewer`             | M    | Med-high     | **Landed** (contacts consolidation: `Lightbox`, `ImageCropper`, `usePanZoom`, transform core; `ZoomPane` can still grow here) |
| 7   | Drawing                    | `draw`               | M/L  | Medium       | Pending                                                                                                                       |
| 8   | Virtualized list           | `hooks`              | M    | Medium       | Pending                                                                                                                       |
| 9   | Expression evaluator       | `expression`         | S/M  | Medium       | Pending                                                                                                                       |
| —   | Pointer tracking util      | internal             | S    | With #6      | Pending                                                                                                                       |
| —   | Drag-and-drop unification  | via refactor roadmap | M    | Low-med      | Deferred                                                                                                                      |
| —   | Form validation layer      | —                    | —    | —            | **Rejected**                                                                                                                  |
| —   | Recurrence rules (RRULE)   | —                    | —    | —            | Deferred                                                                                                                      |

## Suggested phasing

One module ≈ one PR; order chosen so shared infrastructure exists before its
consumers and each PR stays reviewable.

1. **Charts** (`charts`) — landed first by explicit request; brings
   `useMeasuredSize` into `hooks/` as shared infra.
2. **Toast stack + Tabs** — two S-sized primitives, immediate demo dogfood
   (the settings dialog's hand-rolled tab strip refits onto Tabs; archive/undo
   refits onto toasts).
3. **`format`** — tiny, pure; prerequisite for calendar and useful to charts'
   callers (`formatValue`/`formatTick` props accept its functions directly).
4. **Calendar** — core with exhaustive DST/ISO-week tests lands before any UI.
5. **Viewer, then Draw** — the shared pointer-tracking util is built with
   viewer and reused by draw; the Lightbox is then ready to display draw
   output.
6. **Virtual list, Expression** — independent of everything above; slot
   anywhere if priorities shift.

---

## 1. Charts — `charts` (landed)

Zero-dep SVG charts. Pure core: `linearScale` / `timeScale` / `bandScale`,
`linearTicks` (1/2/5 stepping), `timeTicks` (unit-aware), `stackSeries`,
`linePath` (null = gap; linear/monotone curves), `areaPath`, `donutArcs`.
Components: `Sparkline`, `BarChart`, `LineChart`, `DonutChart`.

Decisions of record:

- **Series colors are theme tokens in a fixed order** — `--accent`, `--link`,
  `--flag`, `--path`, `--pipe`, `--meta` — assigned by series position, so
  identity follows the entity and every theme restyles charts for free. The
  order was validated for color-vision-deficiency separation against the
  default dark and light palettes (worst adjacent pair ΔE 18 dark / 14.6
  light, above the ≥ 12 target). Because some dark presets run brighter than
  an ideal mark-lightness band, the components always carry secondary
  encoding: a legend whenever there are ≥ 2 series, 2px surface gaps between
  stacked segments and adjacent bars, and optional direct value labels.
- **One value axis, always.** No dual-axis API; two measures of different
  scale are two charts.
- Accessibility: container `role="img"` with a required `ariaLabel`; an
  optional `desc` renders as SVG `<desc>`. `Sparkline` is `aria-hidden`
  decorative unless labeled.
- App-side seam: data aggregation (bucketing, grouping, what a series
  _means_), drill-down, rich tooltips. The framework renders the series it is
  handed.

## 2. Toast stack — `components` (S, high)

`createToastStore()` (external-store pattern, like `logging`/`achievements`)
plus a `ToastViewport` component. `push({ message, kind?, durationMs?,
action? })` — the `action` slot is the undo seam. `aria-live="polite"` region
(`role="status"`, `alert` for danger), timers pause on hover/focus,
reduced-motion-safe, capped stack. Later (separate PR): re-layer
`pwa/UpdateToast` on it. Demo: "Archived — Undo" toast on row flick-off.

## 3. Tabs — `components` (S, high)

The ARIA tabs pattern (`role="tablist"`/`tab`/`tabpanel`, `aria-controls`,
automatic activation on arrow keys) built on the existing `useRovingTabindex`.
`SegmentedControl` stays — it is a value picker, not a panel switcher. Demo
dogfood: refit the settings dialog's hand-rolled tab strip.

## 4. `format` — `Intl` wrappers (S, high — infra)

Pure utilities over cached `Intl` instances (they are expensive to construct):
`formatNumber`, `formatCompact`, `formatBytes`, `formatDate`,
`formatRelative`, `formatDuration`, `weekdayNames(locale, width)` (rotated by
week start), `monthName`. Locale is always a parameter, `undefined` = browser
default — consistent with "no i18n inside the library". Consumed by calendar
(weekday/month headers) and handed by apps to charts' `formatValue` props.

## 5. Calendar — `calendar` (M/L, high)

Date _math_ is the mechanism; "event"/"appointment"/"due date" are app words
and stay out.

- **Pure core** (`date-math.ts`, `grid.ts`, `range.ts`): day identity as a
  `DayKey` (`"2026-07-04"` — serialization-safe, no ms arithmetic across DST),
  `addDays` / `addMonths` (end-of-month clamped), `startOfWeek(d,
weekStartsOn)`, `isoWeek` (ISO-8601 Thursday rule), `buildMonthGrid(year,
month, { weekStartsOn, fixedWeeks })` → `GridCell[][]` (`inMonth`,
  `isToday`), `buildWeekStrip`, `DayRange` + `isInRange` / `extendRange`.
- **Components:** `MonthGrid` (grid ARIA pattern on the existing
  `useGridRovingTabindex`; `renderDay` render prop is the app's marker seam;
  `min`/`max`/`isDisabled`), `DatePicker` (trigger button + the existing
  `FloatingPanel`/`useFloatingPosition` + `MonthGrid`).
- **Testing focus:** DST transitions, ISO week 52/53/1 boundaries, Jan 31 +
  1 month, `weekStartsOn` rotations, leap years.
- **Recurrence is deliberately out of v1** — full RFC 5545 is a library in
  itself. If a consumer app needs repeats, add a bounded `repeat.ts`
  (`freq`/`interval`/`byWeekday`/`until|count` +
  `occurrencesBetween`) and stay honest that it is not RRULE.
- App-side seam: everything the dates are _for_ — item storage, agenda
  rendering (`DayKey → items[]` + `renderDay`), reminders.

## 6. Media viewer — `viewer` (M, med-high)

Pan/zoom/lightbox are mechanisms; "photo" never appears in the API.

- **Pure core** (`transform.ts`): `ViewTransform { scale, tx, ty }`,
  `zoomAboutPoint`, `clampTransform`, `fitContain`, `panBy` — the invariant
  (the anchor point stays fixed under zoom) is fully unit-testable.
- **Hook:** `usePanZoom` — wheel/trackpad zoom about the cursor, two-pointer
  pinch about the centroid (via the shared pointer-tracking util), one-pointer
  pan when zoomed; at scale 1, horizontal overscroll fires `onOverscrollX`
  (the item-paging seam) and vertical dismissal is left to the existing
  `useSwipeDownToClose`.
- **Components:** `ZoomPane` (any children — an `<img>`, an SVG, a rendered
  draw page); `Lightbox` (composes `Modal`, one `ZoomPane` per active item,
  `items[].render` so the framework never assumes an image source, arrow-key
  paging, "n of m" via `aria-live`).
- App-side seam: sources/URLs/blobs, captions, thumbnail grids, preloading.

## 7. Drawing — `draw` (M/L, medium)

Stroke capture + a serializable stroke model + a render surface; "sketch" is
what an app calls it.

- **Pure core** (`stroke.ts`, `render.ts`): `Stroke { tool: "pen" | "erase";
color; width; points }`, `StrokePage { size, strokes }` — the local-first
  document; `simplifyStroke` (radial-distance thinning), `strokeBounds`,
  versioned `serializePage`/`parsePage`, `renderStrokes(ctx, page)` (the one
  rendering truth for live surface, thumbnails, and export), `pageToBlob`.
- **Hook + component:** `useStrokeCapture` (pointer capture +
  `getCoalescedEvents`, exposes the in-flight stroke), `DrawSurface`
  (devicePixelRatio backing-store sizing via `useMeasuredSize`, committed
  strokes on an offscreen layer, `touch-action: none`).
- **Undo/redo stays app-side by design:** `Stroke[]` is immutable data — the
  app keeps a history stack exactly as the demo's checklist store does and
  wires the existing `useUndoRedoShortcuts`.
- App-side seam: the toolbar (existing `Button`/`SegmentedControl` cover it),
  the store, page naming, export UX.

## 8. Virtualized list — `hooks/useVirtualRows` (M, medium)

Hook-only so it composes with `SwipeableRow`/`Checklist` rows unchanged:
`useVirtualRows({ count, estimateHeight, overscan, scrollRef })` → `{ range,
totalHeight, offsetFor, measure }`, with the windowing math extracted to a
pure `virtual-range.ts`. Known risk to test: interaction with
`usePullToRefresh` scroll ownership. Demo: seed the archive with thousands of
rows.

## 9. Expression evaluator — `expression` (S/M, medium)

Tokenizer → Pratt parser → evaluator; no `eval()`/`Function()`. Errors carry
`{ message, pos, len }` so a caller can underline the offending span.
`evaluateExpression(src, { variables?, functions?, decimalSeparator? })`, a
non-throwing `tryEvaluate`, `roundTo` (float hygiene). Default functions:
`sqrt`, `abs`, `min`, `max`, `round`, `floor`, `ceil`.

**Keypad component: rejected.** A calculator key layout is app vocabulary; the
generic ingredients (`Button`, `useGridRovingTabindex`) already exist. Extract
a pad only if consumer apps duplicate one.

## Rejected / deferred

- **Form validation layer — rejected.** Validation _rules_ are domain by
  definition; React 19 + native constraint validation cover the mechanics; and
  there is no observed duplication across the source apps to extract. What is
  generic already shipped (`ClearableInput`, `InlineEditField` commit/cancel).
- **Recurrence (RRULE) — deferred** with the calendar module's reasoning.
- **Drag-and-drop unification — routed to the refactoring roadmap**: unify
  `sidebar/useDragDrop` + the checklist's reorder plumbing behind one
  `useListReorder` when a third consumer appears; it improves existing
  surface rather than adding new capability.
