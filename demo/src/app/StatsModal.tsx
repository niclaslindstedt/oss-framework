// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import {
  BarChart,
  DonutChart,
  Sparkline,
} from "@niclaslindstedt/oss-framework/charts";
import {
  DatePicker,
  MonthGrid,
  addDays,
  dayKeyOf,
  parseDayKey,
  type DayKey,
} from "@niclaslindstedt/oss-framework/calendar";
import {
  formatDate,
  formatNumber,
  monthName,
} from "@niclaslindstedt/oss-framework/format";
import {
  ExpressionText,
  RevealText,
  chainExpression,
  evaluate,
  formatResult,
  isEvaluable,
} from "@niclaslindstedt/oss-framework/expression";
import { flattenNodes } from "@niclaslindstedt/oss-framework/checklist";
import {
  ClearableInput,
  CloseIcon,
  Modal,
} from "@niclaslindstedt/oss-framework/components";

import { i18n, useLang, useT } from "./i18n/index.ts";
import type { AppData } from "./types.ts";

// The Statistics dialog — the demo's showcase for the framework's `/charts`
// surface plus the `/calendar` components, the `/format` wrappers and the
// `/expression` renderers. Everything
// here is the app-side half of those modules' seams: the app decides what a
// series or a day marker *means* (completions per day, open items per list —
// its own "archived"/"checked" vocabulary), buckets its own data, and hands
// the framework plain values. The charts and the month grid render them
// through the active theme's token palette, so every preset restyles this
// dialog for free.

const WINDOW_DAYS = 14;

// A worked chain for the `/expression` section: two steps where the second
// carried on from the first's result, which `chainExpression` folds back into
// the one expression the pair really was. The app owns what a "step" is; the
// framework only needs its expression, its result, and whether it continued.
const CHAIN_STEPS = [
  { expression: "18+24", result: "42" },
  { expression: "42/7", result: "6", chained: true },
] as const;

// Every checked item bucketed by the local day it was completed —
// `checkedAt` is stamped by the framework's `toggleNode` on every false→true
// flip, so this is pure derivation, nothing extra is stored. Feeds both the
// activity window and the month grid's day markers.
function completionsByDay(data: AppData): Map<DayKey, number> {
  const byDay = new Map<DayKey, number>();
  for (const list of data.lists) {
    if (list.archived) continue;
    for (const item of flattenNodes(list.items)) {
      if (!item.checked || !item.checkedAt || item.archived) continue;
      const key = dayKeyOf(new Date(item.checkedAt));
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
  }
  return byDay;
}

// The trailing activity window: counts for the WINDOW_DAYS days ending at
// `end` (the DatePicker's anchor — today unless the user looks back).
function computeActivity(
  byDay: Map<DayKey, number>,
  end: DayKey,
): { labels: string[]; counts: number[] } {
  const labels: string[] = [];
  const counts: number[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const key = addDays(end, -i);
    labels.push(String(parseDayKey(key)?.day ?? ""));
    counts.push(byDay.get(key) ?? 0);
  }
  return { labels, counts };
}

// Open (unchecked, live) items per live list, largest first — the top five
// lists get their own donut segment, the tail folds into "Other" so the
// segment count stays inside the theme's six-colour vocabulary.
function computeOpenByList(
  data: AppData,
  otherLabel: string,
): { value: number; label: string }[] {
  const rows = data.lists
    .filter((l) => !l.archived)
    .map((l) => ({
      label: l.title,
      value: flattenNodes(l.items).filter((n) => !n.checked && !n.archived)
        .length,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((sum, r) => sum + r.value, 0);
  return rest > 0 ? [...top, { label: otherLabel, value: rest }] : top;
}

export function StatsModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: AppData;
}) {
  const t = useT();
  const locale = i18n.toBcp47(useLang());
  const todayKey = dayKeyOf(new Date());
  // Where the activity window ends — null means "today" (the live view);
  // picking a past day inspects that fortnight instead.
  const [windowEnd, setWindowEnd] = useState<DayKey | null>(null);
  const anchor = windowEnd ?? todayKey;
  // The scratch expression the `/expression` section evaluates, seeded with a
  // sum over the numbers this dialog just showed.
  const [expression, setExpression] = useState("");

  const byDay = useMemo(() => completionsByDay(data), [data]);
  const { labels, counts } = useMemo(
    () => computeActivity(byDay, anchor),
    [byDay, anchor],
  );
  const byList = useMemo(
    () => computeOpenByList(data, t("stats.other")),
    [data, t],
  );
  const doneInWindow = counts.reduce((sum, n) => sum + n, 0);
  const totalOpen = byList.reduce((sum, s) => sum + s.value, 0);

  // The month the activity calendar paints — wherever the anchor sits.
  const gridMonth = parseDayKey(anchor) ?? parseDayKey(todayKey)!;
  const anchorDate = useMemo(() => {
    const p = parseDayKey(anchor);
    return p ? new Date(p.year, p.month - 1, p.day) : new Date();
  }, [anchor]);

  const pickerLabels = {
    placeholder: t("stats.windowEndToday"),
    prevMonth: t("stats.prevMonth"),
    nextMonth: t("stats.nextMonth"),
    clear: t("stats.windowEndToday"),
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="stats-title"
      closeLabel={t("common.close")}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="stats-title"
          className="text-sm font-bold tracking-wide text-fg-bright"
        >
          {t("stats.title")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        <section className="mb-6">
          <div className="flex items-center justify-between gap-2 pt-1 pb-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              {t("stats.activityHeading")}
            </h3>
            {/* The framework `DatePicker` anchors the activity window: null =
                today (the placeholder / clear row both read "Today"), a past
                day inspects that fortnight. */}
            <DatePicker
              value={windowEnd}
              onChange={setWindowEnd}
              max={todayKey}
              today={todayKey}
              locale={locale}
              clearable
              labels={pickerLabels}
              ariaLabel={t("stats.windowEnd")}
            />
          </div>
          {/* Stat tile: the window's headline number + its inline trend. */}
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
            <span className="text-sm text-fg">
              {windowEnd
                ? t("stats.doneInWindowTo", {
                    n: formatNumber(doneInWindow, locale),
                    date: formatDate(anchorDate, locale),
                  })
                : t("stats.doneInWindow", {
                    n: formatNumber(doneInWindow, locale),
                  })}
            </span>
            <Sparkline values={counts} showLastDot />
          </div>
          <BarChart
            series={[{ values: counts }]}
            labels={labels}
            height={160}
            ariaLabel={t("stats.activityAlt")}
          />
        </section>

        <section className="mb-6">
          <h3 className="pt-1 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            {t("stats.calendarHeading")}
          </h3>
          {/* The framework `MonthGrid` as an activity calendar: the app's
              marker seam (`renderDay`) paints a dot on days with completions;
              picking a day re-anchors the activity window above. */}
          <div className="mx-auto max-w-xs">
            <div className="pb-1 text-center text-sm font-medium text-fg-bright">
              {monthName(gridMonth.month, locale)} {gridMonth.year}
            </div>
            <MonthGrid
              year={gridMonth.year}
              month={gridMonth.month}
              selected={windowEnd}
              onSelect={(key) => setWindowEnd(key === todayKey ? null : key)}
              max={todayKey}
              today={todayKey}
              locale={locale}
              renderDay={(cell) => (
                <span
                  aria-hidden
                  className={`mt-0.5 h-1 w-1 rounded-full ${
                    byDay.has(cell.key) && cell.inMonth ? "bg-accent" : ""
                  }`.trim()}
                />
              )}
            />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="pt-1 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            {t("stats.calcHeading")}
          </h3>
          {/* The framework's `/expression` module end to end: what is typed is
              read by `RevealText` (operators lift into chips, bracket groups
              take their own colour, each new character slides in), and the
              same text is evaluated by the module's own parser — no `eval`.
              The app owns only the field and what it seeds it with. */}
          <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
            <ClearableInput
              value={expression}
              onValueChange={setExpression}
              placeholder={`${doneInWindow}/${WINDOW_DAYS}`}
              aria-label={t("stats.calcAria")}
              clearLabel={t("stats.calcClear")}
              inputMode="text"
              className="text-sm"
            />
          </div>
          <div className="mt-2 flex min-h-9 items-baseline justify-between gap-3 px-1">
            <RevealText text={expression} className="text-lg text-fg-bright" />
            <span className="shrink-0 text-lg font-semibold text-accent tabular-nums">
              {expression && isEvaluable(expression)
                ? formatResult(evaluate(expression))
                : ""}
            </span>
          </div>
          {/* `chainExpression` folds a run of "= then keep going" steps back
              into the single expression they add up to — bracketing only where
              the grammar would otherwise re-associate it. */}
          <p className="mt-3 px-1 text-xs text-muted">{t("stats.calcChain")}</p>
          <div className="px-1 text-sm text-fg">
            <ExpressionText
              text={CHAIN_STEPS[0].expression}
              className="oss-expr-soft"
            />
            {" → "}
            <ExpressionText
              text={CHAIN_STEPS[1].expression}
              className="oss-expr-soft"
            />
            {" = "}
            <ExpressionText text={chainExpression([...CHAIN_STEPS], 1) ?? ""} />
          </div>
        </section>

        {byList.length > 0 && (
          <section>
            <h3 className="pt-1 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
              {t("stats.byListHeading")}
            </h3>
            <div className="flex justify-center pt-2">
              <DonutChart
                segments={byList}
                size={170}
                ariaLabel={t("stats.byListAlt")}
                innerLabel={
                  <div>
                    <div className="text-2xl font-bold text-fg-bright tabular-nums">
                      {formatNumber(totalOpen, locale)}
                    </div>
                    <div className="text-xs text-muted">
                      {t("stats.openTotal")}
                    </div>
                  </div>
                }
              />
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
