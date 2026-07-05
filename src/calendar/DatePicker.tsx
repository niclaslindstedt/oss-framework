// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { FloatingPanel } from "../components/FloatingPanel.tsx";
import type { FloatingPlacement } from "../components/useFloatingPosition.ts";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons.tsx";
import { formatDate } from "../format/datetime.ts";
import { monthName } from "../format/names.ts";
import {
  addMonths,
  dayKeyOf,
  parseDayKey,
  toDayKey,
  type DayKey,
  type GridCell,
  type WeekStart,
} from "./grid.ts";
import { MonthGrid } from "./MonthGrid.tsx";

export type DatePickerLabels = {
  /** Trigger text while no day is selected. */
  placeholder: string;
  prevMonth: string;
  nextMonth: string;
  /** The clear row's text (shown when `clearable` and a value is set). */
  clear: string;
};

export const DEFAULT_DATE_PICKER_LABELS: DatePickerLabels = {
  placeholder: "Pick a date",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  clear: "Clear",
};

const PANEL_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 276 },
  anchor: "left",
  coordinateSpace: "document",
};

export type DatePickerProps = {
  /** The selected day, or null when nothing is picked. */
  value: DayKey | null;
  /** A day was picked (or cleared — null — via the clear row). */
  onChange: (key: DayKey | null) => void;
  min?: DayKey;
  max?: DayKey;
  isDisabled?: (key: DayKey) => boolean;
  /** First day of the week, `Date.getDay()` numbering. Default 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** BCP-47 locale for the trigger text, month header, and grid names. */
  locale?: string;
  /** Render the trigger's value text. Defaults to the locale's medium date
   *  ("Jul 5, 2026") via the `format` module. */
  formatValue?: (key: DayKey) => string;
  /** Show a clear row under the grid so the value can go back to null. */
  clearable?: boolean;
  /** The day marked as today in the grid. Defaults to the local today. */
  today?: DayKey;
  /** The app's marker seam, forwarded to the grid's day cells. */
  renderDay?: (cell: GridCell) => ReactNode;
  labels?: Partial<DatePickerLabels>;
  /** Accessible name for the trigger (falls back to its visible text). */
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

// A date field: a bordered trigger button that floats a month grid
// (`FloatingPanel` + `MonthGrid`). The framework owns the popover plumbing —
// positioning, dismissal, focus return, month paging (buttons and PageUp /
// PageDown), keyboard day navigation; the app owns what the date is *for*
// (its storage, its meaning, its markers via `renderDay`). Every visible
// string injects through `labels` with English defaults.
export function DatePicker({
  value,
  onChange,
  min,
  max,
  isDisabled,
  weekStartsOn = 1,
  locale,
  formatValue,
  clearable = false,
  today,
  renderDay,
  labels,
  ariaLabel,
  disabled,
  id,
  className = "",
}: DatePickerProps) {
  const l = { ...DEFAULT_DATE_PICKER_LABELS, ...labels };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const todayKey = today ?? dayKeyOf(new Date());
  // The month on display — re-anchored to the value (or today) on every
  // open, then paged freely without touching the value.
  const [view, setView] = useState(() => anchorMonth(value ?? todayKey));

  const openPanel = () => {
    setView(anchorMonth(value ?? todayKey));
    setOpen(true);
  };
  const close = () => setOpen(false);

  const commit = (key: DayKey | null) => {
    onChange(key);
    close();
    triggerRef.current?.focus();
  };

  const pageMonth = (delta: number) =>
    setView((v) => {
      const paged = parseDayKey(
        addMonths(toDayKey({ year: v.year, month: v.month, day: 1 }), delta),
      );
      return paged ? { year: paged.year, month: paged.month } : v;
    });

  const valueText = value
    ? (formatValue?.(value) ?? defaultValueText(value, locale))
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        className={`flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-left text-sm text-fg hover:border-accent focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
        <span className={`flex-1 truncate ${value ? "" : "text-muted"}`}>
          {valueText ?? l.placeholder}
        </span>
      </button>

      <FloatingPanel
        open={open && !disabled}
        onClose={close}
        triggerRef={triggerRef}
        placement={PANEL_PLACEMENT}
        className="p-2"
      >
        <div className="flex items-center justify-between gap-1 pb-1">
          <button
            type="button"
            aria-label={l.prevMonth}
            onClick={() => pageMonth(-1)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-fg"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div
            aria-live="polite"
            className="text-sm font-medium text-fg-bright"
          >
            {monthName(view.month, locale)} {view.year}
          </div>
          <button
            type="button"
            aria-label={l.nextMonth}
            onClick={() => pageMonth(1)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-fg"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <MonthGrid
          year={view.year}
          month={view.month}
          selected={value}
          onSelect={commit}
          min={min}
          max={max}
          isDisabled={isDisabled}
          weekStartsOn={weekStartsOn}
          fixedWeeks
          today={todayKey}
          locale={locale}
          renderDay={renderDay}
          autoFocus
          onMonthNav={pageMonth}
        />

        {clearable && value && (
          <div className="border-t border-line pt-1">
            <button
              type="button"
              onClick={() => commit(null)}
              className="w-full cursor-pointer rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-3 hover:text-fg"
            >
              {l.clear}
            </button>
          </div>
        )}
      </FloatingPanel>
    </>
  );
}

function anchorMonth(key: DayKey): { year: number; month: number } {
  const parts = parseDayKey(key);
  return parts
    ? { year: parts.year, month: parts.month }
    : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
}

function defaultValueText(key: DayKey, locale: string | undefined): string {
  const parts = parseDayKey(key);
  if (!parts) return key;
  return formatDate(new Date(parts.year, parts.month - 1, parts.day), locale);
}
