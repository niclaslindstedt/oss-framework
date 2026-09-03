// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo } from "react";
import type { ReactNode } from "react";

import { useGridRovingTabindex } from "../hooks/useRovingTabindex.ts";
import { formatDate } from "../format/datetime.ts";
import { monthName, weekdayNames } from "../format/names.ts";
import {
  buildMonthGrid,
  dayKeyOf,
  parseDayKey,
  type DayKey,
  type GridCell,
  type WeekStart,
} from "./grid.ts";

export type MonthGridProps = {
  /** The month on display. `month` is 1-based. */
  year: number;
  month: number;
  /** The selected day, if any — painted `aria-selected` and accented. */
  selected?: DayKey | null;
  /** A day was activated (click, Enter, Space). Absent ⇒ a read-only grid. */
  onSelect?: (key: DayKey) => void;
  /** Days before `min` / after `max` render disabled (kept focusable, per
   *  the ARIA grid pattern, but not activatable). */
  min?: DayKey;
  max?: DayKey;
  /** App-side veto over individual days (a blackout predicate). */
  isDisabled?: (key: DayKey) => boolean;
  /** First day of the week, `Date.getDay()` numbering. Default 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** Always render six week rows — a paged UI keeps a stable height. */
  fixedWeeks?: boolean;
  /** The day to mark as today. Defaults to the runtime's local today; pass
   *  explicitly for a deterministic render. */
  today?: DayKey;
  /** BCP-47 locale for the weekday header and the day names spoken to
   *  assistive tech; `undefined` = the browser default. */
  locale?: string;
  /** The app's marker seam: extra content rendered inside a day cell under
   *  its number (a dot, a count badge). The cell stays one button; keep
   *  markers non-interactive. */
  renderDay?: (cell: GridCell) => ReactNode;
  /** Seat keyboard focus on the grid when it mounts / re-seats — the
   *  popover-panel behaviour. Off by default so an inline grid never steals
   *  focus. */
  autoFocus?: boolean;
  /** PageUp / PageDown inside the grid page the month when the caller can
   *  navigate (`-1` / `+1`). */
  onMonthNav?: (delta: number) => void;
  /** Accessible name for the grid. Defaults to "<Month> <Year>" in the
   *  given locale. */
  label?: string;
  /** Accessible name for one day button. Defaults to the locale's long date
   *  ("July 5, 2026"). */
  dayLabel?: (key: DayKey) => string;
  className?: string;
};

function defaultDayLabel(key: DayKey, locale: string | undefined): string {
  const parts = parseDayKey(key);
  if (!parts) return key;
  return formatDate(new Date(parts.year, parts.month - 1, parts.day), locale, {
    dateStyle: "long",
  });
}

// Month-of-days grid following the WAI-ARIA grid pattern: one Tab stop
// (roving tabindex via `useGridRovingTabindex`), arrow keys walk days,
// Home / End jump the corners, PageUp / PageDown page the month when the
// host can navigate. Weekday headers and the grid's accessible name come
// from the `format` module's locale wrappers, so no name tables ship twice.
// The framework owns the grid mechanics; what a day *means* — its markers,
// its blackout rules, what selecting it does — stays with the app
// (`renderDay`, `isDisabled`, `onSelect`).
export function MonthGrid({
  year,
  month,
  selected = null,
  onSelect,
  min,
  max,
  isDisabled,
  weekStartsOn = 1,
  fixedWeeks = false,
  today,
  locale,
  renderDay,
  autoFocus = false,
  onMonthNav,
  label,
  dayLabel,
  className = "",
}: MonthGridProps) {
  const todayKey = today ?? dayKeyOf(new Date());
  const weeks = useMemo(
    () =>
      buildMonthGrid(year, month, {
        weekStartsOn,
        fixedWeeks,
        today: todayKey,
      }),
    [year, month, weekStartsOn, fixedWeeks, todayKey],
  );
  const cells = useMemo(() => weeks.flat(), [weeks]);

  const headerShort = weekdayNames(locale, "short", weekStartsOn);
  const headerLong = weekdayNames(locale, "long", weekStartsOn);

  const disabledAt = (cell: GridCell): boolean =>
    (min !== undefined && cell.key < min) ||
    (max !== undefined && cell.key > max) ||
    (isDisabled?.(cell.key) ?? false);

  // Seat the cursor on the selected day when it's in view, else today, else
  // the month's first day.
  const initialIndex = useMemo(() => {
    const bySelected = selected
      ? cells.findIndex((c) => c.key === selected)
      : -1;
    if (bySelected !== -1) return bySelected;
    const byToday = cells.findIndex((c) => c.isToday);
    if (byToday !== -1) return byToday;
    return Math.max(
      0,
      cells.findIndex((c) => c.inMonth),
    );
  }, [cells, selected]);

  const grid = useGridRovingTabindex({
    itemCount: cells.length,
    columns: 7,
    initialIndex,
    active: autoFocus,
  });

  return (
    <div
      role="grid"
      aria-label={label ?? `${monthName(month, locale)} ${year}`}
      className={`grid grid-cols-7 ${className}`.trim()}
    >
      <div role="row" className="contents">
        {headerShort.map((name, i) => (
          <div
            key={name}
            role="columnheader"
            aria-label={headerLong[i]}
            className="pb-1 text-center text-xs font-medium text-muted"
          >
            {name}
          </div>
        ))}
      </div>
      {weeks.map((row, r) => (
        <div key={row[0]?.key ?? r} role="row" className="contents">
          {row.map((cell, c) => {
            const index = r * 7 + c;
            const isSelected = cell.key === selected;
            const disabled = disabledAt(cell);
            return (
              <div
                key={cell.key}
                role="gridcell"
                // The day this cell stands for, in the markup rather than
                // only in the closure. A gesture added from *outside* the
                // grid — a press-and-hold, a drag across a span (see
                // `useDayPress`) — listens on the element the grid sits in
                // and has no handler of its own on the cell, so it needs a
                // way to ask which day it landed on. This is that way, and it
                // is a smaller claim on the markup than reading the button's
                // accessible name, which is a localized date string.
                data-day={cell.key}
                aria-selected={isSelected || undefined}
                className="p-0.5"
              >
                <button
                  type="button"
                  ref={grid.registerItem(index)}
                  tabIndex={grid.isCursorAt(index) ? 0 : -1}
                  aria-label={
                    dayLabel
                      ? dayLabel(cell.key)
                      : defaultDayLabel(cell.key, locale)
                  }
                  aria-disabled={disabled || undefined}
                  aria-current={cell.isToday ? "date" : undefined}
                  onKeyDown={(e) => {
                    if (onMonthNav && e.key === "PageUp") {
                      e.preventDefault();
                      onMonthNav(-1);
                      return;
                    }
                    if (onMonthNav && e.key === "PageDown") {
                      e.preventDefault();
                      onMonthNav(1);
                      return;
                    }
                    grid.onKeyDown(e);
                  }}
                  onClick={() => {
                    if (!disabled) onSelect?.(cell.key);
                  }}
                  className={[
                    "flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-md text-sm transition-colors",
                    isSelected
                      ? "border border-accent bg-accent/20 font-medium text-accent"
                      : cell.isToday
                        ? "font-semibold text-accent hover:bg-surface-3"
                        : cell.inMonth
                          ? "text-fg hover:bg-surface-3"
                          : "text-muted/60 hover:bg-surface-3",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="leading-none">{cell.day}</span>
                  {renderDay?.(cell)}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
