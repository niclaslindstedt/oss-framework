// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons.tsx";
import { useSwipeNav } from "../hooks/useSwipeNav.ts";
import { formatMonthLabel } from "./format.ts";
import { MonthGrid } from "./MonthGrid.tsx";
import {
  addMonths,
  dayKeyOf,
  parseDayKey,
  type DayKey,
  type GridCell,
  type WeekStart,
} from "./grid.ts";

// A month grid that can be paged: `MonthGrid` plus the header, the arrows and
// the month cursor that every caller was otherwise writing for itself.
//
// `MonthGrid` is deliberately just the grid — it paints the year and month it
// is handed and leaves paging to the caller — and that is the right seam for
// the grid to expose, because a date field, an inline calendar and a
// full-screen month view do not all page the same way. But *most* of them page
// exactly this way, and "keep a cursor in state, step it by a month, render
// the heading, wire the arrows, mount the swipe" is a page of plumbing with
// nothing app-specific in it. So it lives here, once.
//
// `renderDay` passes straight through: what a marker on a day *means* is the
// one thing only the caller knows.
//
// **The swipe.** A row of months is an ordered axis and a finger on a
// calendar means "the next month" — but a screen that also pages tabs on a
// swipe would otherwise eat the gesture first. So the wrapper marks itself
// `data-swipe-ignore`, which stands the outer mount down, and then mounts the
// same hook on that element, which reads its own marker as the claim it is
// rather than as a veto (see `useSwipeNav`). Both gestures work, and the
// nearer one wins.

/** Labels for the two paging controls. Injected rather than hard-coded: the
 *  framework ships no translations, so an adopter's own catalog is the only
 *  place these can honestly come from. */
export type MonthCalendarLabels = {
  prevMonth: string;
  nextMonth: string;
};

export const DEFAULT_MONTH_CALENDAR_LABELS: MonthCalendarLabels = {
  prevMonth: "Previous month",
  nextMonth: "Next month",
};

export type MonthCalendarProps = {
  /** The month to show, named by a day in it. The cursor is seeded from this
   *  and then owned here, so paging away and selecting a day in another month
   *  both work — but moving the anchor to a *different* month re-seats the
   *  view on it, because that is what asking for another month looks like. */
  anchor: DayKey;
  /** The selected day, if any. */
  selected?: DayKey | null;
  onSelect?: (day: DayKey) => void;
  /** Days outside these bounds render disabled. */
  min?: DayKey;
  max?: DayKey;
  /** App-side veto over individual days (a blackout predicate). */
  isDisabled?: (day: DayKey) => boolean;
  /** First day of the week, `Date.getDay()` numbering. Default 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** The day to mark as today. Defaults to the runtime's local today; pass
   *  explicitly for a deterministic render. */
  today?: DayKey;
  /** BCP-47 locale for the heading, the weekday header and the day names
   *  spoken to assistive tech; `undefined` = the browser default. */
  locale?: string;
  /** The app's marker seam, forwarded to `MonthGrid`. */
  renderDay?: (cell: GridCell) => ReactNode;
  /** Always render six week rows. Default true — a *paged* grid that changes
   *  height as it steps makes everything under it jump, which is the whole
   *  reason the option exists. */
  fixedWeeks?: boolean;
  /** Told when the displayed month changes, for a caller that mirrors the
   *  cursor (a title elsewhere, a fetch). The cursor stays owned here. */
  onMonthChange?: (month: DayKey) => void;
  labels?: Partial<MonthCalendarLabels>;
  className?: string;
};

export function MonthCalendar({
  anchor,
  selected = null,
  onSelect,
  min,
  max,
  isDisabled,
  weekStartsOn = 1,
  today,
  locale,
  renderDay,
  fixedWeeks = true,
  onMonthChange,
  labels,
  className = "",
}: MonthCalendarProps) {
  const text = { ...DEFAULT_MONTH_CALENDAR_LABELS, ...labels };
  const [cursor, setCursor] = useState<DayKey>(anchor);

  // Re-seat when the anchor itself moves to a *different month*. The cursor
  // is owned here so paging survives a re-render, but "anchor" names the
  // month to show, and a caller that moves it across a month boundary (a date
  // field elsewhere, a restored session) is asking for that month.
  //
  // The comparison is anchor-against-previous-anchor, deliberately, not
  // anchor-against-cursor: the usual reason an anchor moves is that the user
  // selected a day, and a cursor comparison would then snap a reader who had
  // paged away back to the month they left. Only a move the *caller* made
  // across months re-seats the view; paging is never undone by one.
  //
  // Adjusted during render rather than from an effect, which is React's own
  // recommendation for state derived from a prop — an effect would paint the
  // old month first and then correct it.
  const [seated, setSeated] = useState<DayKey>(anchor);
  if (seated !== anchor) {
    if (anchor.slice(0, 7) !== seated.slice(0, 7)) setCursor(anchor);
    setSeated(anchor);
  }

  // Stepped from the month it is moving *off*, so the callback identity never
  // changes — the swipe hook keys its listeners on it, and a new function
  // every render would tear them down and rebuild them every render.
  const step = useCallback((delta: number) => {
    setCursor((current) => addMonths(current, delta));
  }, []);

  // `onMonthChange` fires from an effect rather than from inside the updater
  // above: a state updater must stay pure, and StrictMode calls it twice to
  // say so. Skipped on mount, because arriving at the anchor month is not the
  // month changing.
  const changed = useRef(onMonthChange);
  changed.current = onMonthChange;
  const announced = useRef(cursor);
  useEffect(() => {
    if (announced.current === cursor) return;
    announced.current = cursor;
    changed.current?.(cursor);
  }, [cursor]);

  const root = useRef<HTMLDivElement>(null);
  // A swipe leftward brings the next month in from the right, which is the
  // direction `useSwipeNav` reports as `1`.
  useSwipeNav(root, step);

  const parts = parseDayKey(cursor) ?? parseDayKey(anchor);
  if (!parts) return null;

  return (
    <div
      ref={root}
      data-swipe-ignore
      className={`flex flex-col gap-2 ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={text.prevMonth}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-fg-bright">
          {formatMonthLabel(parts.year, parts.month, locale)}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={text.nextMonth}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      <MonthGrid
        year={parts.year}
        month={parts.month}
        selected={selected}
        onSelect={onSelect}
        min={min}
        max={max}
        isDisabled={isDisabled}
        today={today ?? dayKeyOf(new Date())}
        weekStartsOn={weekStartsOn}
        locale={locale}
        onMonthNav={step}
        renderDay={renderDay}
        fixedWeeks={fixedWeeks}
      />
    </div>
  );
}
