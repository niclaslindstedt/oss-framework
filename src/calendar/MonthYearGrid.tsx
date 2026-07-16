// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo } from "react";

import { useGridRovingTabindex } from "../hooks/useRovingTabindex.ts";
import { monthName } from "../format/names.ts";
import { toDayKey, type DayKey } from "./grid.ts";

// The "zoom out" step of the date picker: a 3×4 grid of the twelve months, or
// of a twelve-year page, that lets the user jump a month or a year at a glance
// instead of paging one month at a time — the quick month/year pick a native
// date control offers. It is the same WAI-ARIA grid pattern `MonthGrid` uses
// (one Tab stop via `useGridRovingTabindex`, arrows walk cells, Home/End jump
// the corners), so keyboard and screen-reader behaviour match the day grid.
// `min`/`max` gate whole months / years the same way they gate days: an
// out-of-range cell stays focusable, per the pattern, but isn't activatable.
// It renders no popover of its own — `DatePicker` swaps it into the open panel
// in place of the day grid, so choosing a month or year is ordinary in-panel
// interaction (which is what keeps it alive inside an iOS PWA).

export type MonthYearGridProps = {
  /** `"month"` paints the twelve months of `year`; `"year"` paints the
   *  twelve-year page starting at `yearPageStart`. */
  mode: "month" | "year";
  /** The year whose months are shown (month mode) and the year highlighted
   *  as the current view. */
  year: number;
  /** First year of the twelve-year page (year mode). */
  yearPageStart: number;
  /** The selected value's parts, highlighted when it falls on a painted
   *  cell. */
  selected?: { year: number; month: number } | null;
  /** Today's parts, marked with `aria-current` on the matching cell. */
  today: { year: number; month: number };
  min?: DayKey;
  max?: DayKey;
  /** BCP-47 locale for the month names and spoken cell labels. */
  locale?: string;
  /** A cell was activated: the month (1–12) in month mode, the year in year
   *  mode. */
  onPick: (value: number) => void;
  /** Accessible name for the grid (the year, or the year range). */
  label: string;
};

// A month is out of range when its whole span falls before `min` or after
// `max`; a year, when its whole span does. Day-level `isDisabled` never
// applies at this granularity — only the calendar bounds do, matching a native
// control's month/year wheels.
function monthDisabled(
  year: number,
  month: number,
  min: DayKey | undefined,
  max: DayKey | undefined,
): boolean {
  const first = toDayKey({ year, month, day: 1 });
  // Day 0 of the next month is this month's last day.
  const last = toDayKey({ year, month: month + 1, day: 0 });
  return (
    (min !== undefined && last < min) || (max !== undefined && first > max)
  );
}

function yearDisabled(
  year: number,
  min: DayKey | undefined,
  max: DayKey | undefined,
): boolean {
  const first = toDayKey({ year, month: 1, day: 1 });
  const last = toDayKey({ year, month: 12, day: 31 });
  return (
    (min !== undefined && last < min) || (max !== undefined && first > max)
  );
}

export function MonthYearGrid({
  mode,
  year,
  yearPageStart,
  selected = null,
  today,
  min,
  max,
  locale,
  onPick,
  label,
}: MonthYearGridProps) {
  // The twelve cells, as { value, text, disabled, isSelected, isToday }.
  const cells = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      if (mode === "month") {
        const month = i + 1;
        return {
          value: month,
          text: monthName(month, locale, "short"),
          fullText: `${monthName(month, locale)} ${year}`,
          disabled: monthDisabled(year, month, min, max),
          isSelected: selected?.year === year && selected?.month === month,
          isToday: today.year === year && today.month === month,
        };
      }
      const y = yearPageStart + i;
      return {
        value: y,
        text: String(y),
        fullText: String(y),
        disabled: yearDisabled(y, min, max),
        isSelected: selected?.year === y,
        isToday: today.year === y,
      };
    });
  }, [mode, year, yearPageStart, selected, today, min, max, locale]);

  // Seat the cursor on the selected cell, else today's, else the current view.
  const initialIndex = useMemo(() => {
    const bySelected = cells.findIndex((c) => c.isSelected);
    if (bySelected !== -1) return bySelected;
    const byToday = cells.findIndex((c) => c.isToday);
    if (byToday !== -1) return byToday;
    return mode === "month"
      ? 0
      : Math.max(0, Math.min(11, year - yearPageStart));
  }, [cells, mode, year, yearPageStart]);

  const grid = useGridRovingTabindex({
    itemCount: 12,
    columns: 3,
    initialIndex,
    active: true,
  });

  return (
    <div role="grid" aria-label={label} className="grid grid-cols-3 gap-1 py-1">
      {cells.map((cell, index) => (
        <div key={cell.value} role="gridcell" className="p-0.5">
          <button
            type="button"
            ref={grid.registerItem(index)}
            tabIndex={grid.isCursorAt(index) ? 0 : -1}
            aria-label={cell.fullText}
            aria-disabled={cell.disabled || undefined}
            aria-current={cell.isToday ? "date" : undefined}
            aria-pressed={cell.isSelected || undefined}
            onKeyDown={grid.onKeyDown}
            onClick={() => {
              if (!cell.disabled) onPick(cell.value);
            }}
            className={[
              "flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-sm transition-colors",
              cell.isSelected
                ? "border border-accent bg-accent/20 font-medium text-accent"
                : cell.isToday
                  ? "font-semibold text-accent hover:bg-surface-3"
                  : "text-fg hover:bg-surface-3",
              cell.disabled ? "cursor-not-allowed opacity-40" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {cell.text}
          </button>
        </div>
      ))}
    </div>
  );
}
