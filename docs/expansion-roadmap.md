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
| 4   | `format` — `Intl` wrappers | `format`             | S    | High (infra) | **Landed** (URL/digit/byte helpers, then the full `Intl` wrapper set)                                                         |
| 5   | Calendar                   | `calendar`           | M/L  | High         | **Landed** (recurring-date math + `.ics`, then the grid core + `MonthGrid`/`DatePicker`)                                      |
| 6   | Media viewer               | `viewer`             | M    | Med-high     | **Landed** (contacts consolidation: `Lightbox`, `ImageCropper`, `usePanZoom`, transform core; `ZoomPane` can still grow here) |
| 7   | Drawing                    | `draw`               | M/L  | Medium       | Pending                                                                                                                       |
| 8   | Virtualized list           | `hooks`              | M    | Medium       | Pending                                                                                                                       |
| 9   | Expression evaluator       | `expression`         | S/M  | Medium       | **Landed** (calc consolidation: evaluator, segment reading, chain folding, paste, `ExpressionText`/`RevealText`)              |
| 10  | App shell                  | `components`/`hooks` | M    | High         | **Landed** (meds/cycle consolidation: `BottomNav` + `stepDirection`, `useSwipeNav`, `MonthCalendar`, `useDayPress`)           |
| 11  | Local-first document       | `document`           | L    | High         | Pending (meds/cycle consolidation — the largest remaining duplication)                                                        |
| 12  | Probability + statistics   | `stats`              | M    | Medium       | Pending (cycle consolidation)                                                                                                 |
| 13  | Fitted text                | `fit`                | S/M  | High         | **Landed** (calendar consolidation: pre-layout size band + the measured shrink/clip pass)                                     |
| 14  | Pager                      | `components`         | M    | High         | **Landed** (calendar consolidation: `SwipeDeck`)                                                                              |
| 15  | Colour mixing              | `color`              | S/M  | Medium       | **Landed** (paint consolidation: hex ⇄ HSV + `ColorMixer`)                                                                    |
| 16  | Undo timeline              | `history`            | S    | High         | **Landed** (paint consolidation: pure stacks + `useHistory`)                                                                  |
| 17  | Stored arrangements        | `order`              | S    | Medium       | **Landed** (paint consolidation)                                                                                              |
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

## 4. `format` — `Intl` wrappers (landed)

Pure utilities over cached `Intl` instances (they are expensive to construct):
`formatNumber`, `formatCompact`, `formatBytes`, `formatDate`,
`formatRelative`, `formatDuration`, `weekdayNames(locale, width,
weekStartsOn)` (rotated by week start), `monthName`. Locale is always a
parameter, `undefined` = browser default — consistent with "no i18n inside
the library". Consumed by calendar (weekday/month headers) and handed by apps
to charts' `formatValue` props.

Decisions of record:

- **`formatRelative(date, now, locale?)` takes `now` explicitly** — nothing
  in the module reads the clock, matching the calendar core's convention, so
  every wrapper is deterministic under test.
- **`formatDuration` avoids `Intl.DurationFormat`** (still uneven across
  engines); it composes `Intl.NumberFormat` unit style instead and renders
  the largest unit plus its non-zero adjacent neighbour ("1 hr 23 min", but
  "1 hr" — never "1 hr 30 sec" — when the minutes are zero).
- **Weekday indices use `Date.getDay()` numbering** (0 = Sunday), default
  week start Monday (ISO-8601) — shared with the calendar module.

## 5. Calendar — `calendar` (landed)

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

Decisions of record (as landed):

- **"Today" is a caller-supplied `DayKey`** throughout the pure core
  (`MonthGridOptions.today`); only the components default it to the local
  clock, and both accept an explicit `today` for deterministic renders.
- **Arrow keys navigate the rendered grid only** (the roving-tabindex
  seam); crossing a month boundary is PageUp / PageDown (`onMonthNav`) or
  selecting a spill day — not an arrow walking off the row. Full
  APG-style arrow paging can layer on later without an API break.
- **`MonthGrid` never steals focus by default** — `autoFocus` (off unless
  the grid sits in a popover, as in `DatePicker`) maps to the roving
  hook's `active` flag.
- **Disabled days stay focusable** (`aria-disabled`, no action) per the
  ARIA grid pattern, so keyboard users can still survey the month.
- **Range selection ships as pure helpers only** (`dayRange`, `isInRange`,
  `extendRange`); a two-ended range _picker_ is app assembly on top of
  `MonthGrid` until a second consumer shows the shape a component needs.
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

## 9. Expression evaluator — `expression` (landed)

Tokenizer → recursive-descent parser → evaluator; no `eval()`/`Function()`.
Landed larger than planned, because the calc app had already grown the whole
shape and it came over as one piece: the evaluator (`evaluate`,
`isEvaluable`, `closeParens`, `formatResult`, `formatHex`), the _reading_ of
an expression (`expressionSegments` → operator chips, symbol functions,
bracket depth; `depthClass`; `toggleSign`), chain folding
(`chainExpression` over a generic `ChainStep`), clipboard candidates
(`pasteCandidate`), and the two renderers `ExpressionText` / `RevealText`.

Decisions of record:

- **The source text is the document.** Everything here operates on the
  expression a user typed, not on a computed number, so an app stores the
  text and gets the same answer on the next open.
- **Errors throw `EvalError` with a message a display can show verbatim**,
  rather than carrying `{ pos, len }` spans. The consumer surface is a
  cursorless readout, which has nowhere to underline; add the span when a
  consumer with a text cursor turns up.
- **Trailing brackets are closed for the caller** (`closeParens`) and
  juxtaposition multiplies (`5(6+6)`, `2π`, `3sqrt(9)`), because that is how
  the expression is written on paper.
- **`RateLimit`-style options over constants**: the symbol-function map is a
  caller option (`symbols`), not a fixed table.
- **Paint is `.oss-expr-*` in `framework.css`**, with the three
  bracket-depth colours mapped to the `link` / `pipe` / `path` theme tokens,
  so every preset dresses an expression in its own syntax colours.

**Keypad component: still rejected.** A calculator key layout is app
vocabulary; the generic ingredients (`Button`, `useGridRovingTabindex`)
already exist. Extract a pad only if consumer apps duplicate one.

## 10. App shell — `components` / `hooks` / `calendar` (landed)

Landed from the `meds` and `cycle` consolidation. Both apps are phone-shaped
local-first PWAs — four bottom tabs, a swipe along them, a month view — and
both had grown their own copy of the same shell, in places byte for byte
(`chartAxis.ts` was identical; `useSwipeNav.ts` and `MonthCalendar.tsx`
differed only in comments).

What landed and why it is the framework's rather than an app's:

- **`BottomNav`** — the `Sidebar`'s counterpart for an app with a handful of
  destinations used one-handed. With **`stepDirection`**, the pure "which way
  along the order is this move" function that the screen transition and the
  swipe must both read, or the animation contradicts the finger.
- **`useSwipeNav`** — a touch swipe that steps one place along an ordered
  axis. The interesting part is the refusals (sliders, dialogs, sideways
  scrollers) and that `data-swipe-ignore` is a _claim_ rather than a veto, so
  a paging month grid nests inside a paging screen.
- **`MonthCalendar`** — `MonthGrid` is deliberately just the grid, but every
  caller that pages it writes the same cursor, heading, arrows and swipe.
- **`useDayPress`** — press-and-hold on a day cell, added from outside the
  grid so the grid keeps its one gesture. `MonthGrid` now marks each cell with
  `data-day`, which is what lets an outside listener answer "which day?"
  without the app planting a marker inside `renderDay`.
- **`niceTicks`** — `linearTicks`' sibling: a _cap_ on the tick count rather
  than a target, plus the label precision, which is the half a caller
  otherwise re-derives and gets wrong.
- **`formatDayKey` / `formatMonthLabel` / `dayKeyToDate`** — rendering a
  `DayKey` as local midnight. `new Date("2026-07-05")` parses as UTC and lands
  a day early west of Greenwich; that conversion should exist once.
- **`weekdayOrder`** — `weekdayNames`' index-returning sibling.

## 11. Local-first document — `document` (L, high)

**The largest remaining duplication between the sibling apps**: `meds` and
`cycle` each carry ~750 lines of near-identical document plumbing, and the
diff between the two copies of the 490-line sync engine is 60 lines of
comments, app-name strings and one function reference.

What is generic, and what stays with the app:

| Generic (the framework's)                                                                                                     | The app's                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| The `DocBackend` seam and the localStorage backend over an injected codec                                                     | What a document _is_            |
| Non-destructive read (quarantine unreadable bytes, never blank the key)                                                       | The migration steps             |
| The store lifecycle: load-on-mount, write-through, `editCount`, `loaded`, `writeFailures`                                     | The edit vocabulary             |
| The sync engine: adapter selection, debounced push, baseline pull, conflict/auth/throttle handling, OAuth redirect completion | The merge function              |
| An in-memory backend that _takes over_ storage (the demo-data pattern)                                                        | What the demo document contains |
| Backup download / restore over the same codec                                                                                 | The file name                   |

Shape: a `useDocument<T>` over `{ key, codec, backend }` exposing
`update(fn)` for the app to build its own edits on, and a `useSyncEngine<T>`
parameterized by `{ slug, fileName, appFolder, codec, merge }`. The engine is
~490 lines and the module-file ceiling is 1000, but it wants splitting by
concern regardless (credentials, adapter selection, the push/pull loop).

Note the one thing that must **not** cross: the merge. "Last edit wins per
day" (`cycle`) and "union of taps" (`meds`) are both correct for their app and
neither is the framework's to choose.

## 12. Probability + statistics — `stats` (M, medium)

`cycle`'s `src/app/stats.ts` is ~300 lines of textbook numerics with no
domain in it at all: `logGamma`, `regularizedIncompleteBeta`, Student-t
pdf/cdf, weighted moments, `median`, and a discrete-distribution set
(`normalize`, `pmfMean`, `pmfStdev`, `pmfQuantile`, `credibleInterval`,
`convolve`, `pmfMassBetween`). It already has textbook-value tests.

Zero dependencies, pure, no DOM — it is the numeric floor a forecasting or
scoring app needs and is the reason such an app currently has to vendor its
own. Pairs naturally with `charts`. One judgement to make on extraction:
whether the `Pmf` shape (a `{ start, values }` discrete distribution) is
general enough to publish as-is, or wants a slimmer contract.

## 13–17. The calendar / paint consolidation (landed)

Five modules and a handful of primitives, mined from the sibling
[`calendar`](https://github.com/niclaslindstedt/calendar) and
[`paint`](https://github.com/niclaslindstedt/paint) apps. Each had been built
twice, or was one app away from being built twice:

- **`fit`** — text sized to a box it cannot leave. A pre-layout band
  (`resolveFontPx`, `scaleBand`) so the first paint does not flash, then the
  measured pass (`fitTextSize`, `clipTextToBox`) whose `fits: false` is the part
  `-webkit-line-clamp` cannot report — and therefore the thing that lets a
  _writing_ surface refuse the keystroke that would overflow.
  `components/plainTextEditable.ts` is what makes such a box writable in place,
  since a `<textarea>` can neither wrap around a float nor shrink.
- **`SwipeDeck`** — the pager. Three panes on a track, a drag that never
  re-renders, a commit that swaps the anchor before it animates. Either axis,
  nestable perpendicular, and able to hand a vertical drag to a scrolling pane
  until the pane runs out.
- **`color`** — `ColorMixer` over hex ⇄ HSV. Deliberately not a swatch grid;
  `glyphs/ColorPalette` is one and the two compose.
- **`history`** — the state half of `useUndoRedoShortcuts`, generic in what a
  rung holds, because a rung is _what a step has to put back_ and that is
  usually more than the document.
- **`order`** — a persisted list of ids applied back onto whatever entries this
  build ships.

…plus `IconButton`, `useDialogDrag` (with `Modal` reading its offset into
`translate`), `calendar/rules.ts` (Easter and the weekday rules a holiday table
is written in), `hooks/keyboardTarget.ts`, `hooks/tap.ts`,
`sidebar/edgeSwipe.ts`, `theme/theme-color.ts`, `pwa/viewport.ts` and
`pwa/shellScroll.ts`.

### Still with those apps, and why

| Left behind                                                | Why                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| calendar's `roomScale.ts` / `textSize.ts`                  | The mechanism (scale type by the screen's area, against two measured anchors) is generic; the **anchors** are that app's measurements. Wants a second consumer before the curve is published — `scaleBand` is the seam it would reach through. |
| calendar's `locale/` packs, `hyphenate.ts`                 | The hyphenation _machinery_ is generic and the **rules** are per-language. Extractable as `format/hyphenate.ts` once a second app needs soft-hyphen seeding; alone it is a solution to one app's 47 px cell.                                   |
| calendar's `stripLayout.ts` / `viewStyle.ts` / `monthCell` | Layout vocabulary for an almanac. Domain.                                                                                                                                                                                                      |
| paint's `plugins/`, `render.ts`, `effects.ts`, `cutout.ts` | The drawing domain. Roadmap #7 (`draw`) is the generic slice, and it is a different, smaller thing than these.                                                                                                                                 |
| paint's `adjust.ts` + `histogram.ts` + `CurveEditor`       | A coherent **image-adjustment** module (per-channel LUTs, levels, curves, the tone histogram, the two controls drawn over it). Genuinely generic and genuinely large — its own roadmap entry when `draw` is picked up.                         |
| paint's `tiles.ts`                                         | An off-screen render cache with an idle queue. Generic in shape, but every key in it is a function of that app's renderer; wants a second consumer to say what the key contract should be.                                                     |
| paint's `useCanvasView.ts` / `viewport.ts`                 | Overlaps `viewer/usePanZoom` without matching it. The right move is to grow `usePanZoom` (wheel, a settle frame, a clamp that keeps the sheet reachable) rather than ship a second pan/zoom.                                                   |
| paint's `clipboard.ts`                                     | Reads images and files, where `hooks/useClipboard` only writes text. Should grow that hook rather than land beside it.                                                                                                                         |
| paint's `units.ts`, `canvasSize.ts`                        | Page sizes in millimetres against a calibrated dpi. Arguably `format`, but it is one app's calibration; deferred.                                                                                                                              |

## Rejected / deferred

- **Form validation layer — rejected.** Validation _rules_ are domain by
  definition; React 19 + native constraint validation cover the mechanics; and
  there is no observed duplication across the source apps to extract. What is
  generic already shipped (`ClearableInput`, `InlineEditField` commit/cancel).
- **Recurrence (RRULE) — deferred** with the calendar module's reasoning.
- **A percentage formatter — routed to the refactoring roadmap.** Both apps
  floor a share to a whole percent, print `"<1%"` rather than `"0%"` for a
  small-but-real value, and reserve a flat `"0%"` for a genuine zero; they
  differ only on whether a true 1.0 may print as `"100%"`. That is a
  `formatPercent` option away from being one function in `format`.
- **`Pill` / `DateSpan` (cycle) — deferred.** The chip itself overlaps
  `Badge`; the right move is to grow `Badge` a size and a `solid` tone rather
  than ship a near-twin, and the subgrid span list wants a second consumer
  before it earns a place.
- **`cacheIdForBase` (both apps) — deferred to `pwa`.** Nine lines deriving a
  precache cache id from the bundler `base`; it belongs next to
  `usePwaUpdate`, but is too small to move on its own.
- **Drag-and-drop unification — routed to the refactoring roadmap**: unify
  `sidebar/useDragDrop` + the checklist's reorder plumbing behind one
  `useListReorder` when a third consumer appears; it improves existing
  surface rather than adding new capability.
