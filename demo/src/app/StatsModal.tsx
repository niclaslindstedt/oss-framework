// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo } from "react";

import {
  BarChart,
  DonutChart,
  Sparkline,
} from "@niclaslindstedt/oss-framework/charts";
import { flattenNodes } from "@niclaslindstedt/oss-framework/checklist";
import { CloseIcon, Modal } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import type { AppData } from "./types.ts";

// The Statistics dialog — the demo's showcase for the framework's `/charts`
// surface. Everything here is the app-side half of that module's seam: the
// app decides what a series *means* (completions per day, open items per
// list — its own "archived"/"checked" vocabulary), buckets its own data, and
// hands the framework plain values. The charts render them through the
// active theme's token palette, so every preset restyles this dialog for
// free.

const WINDOW_DAYS = 14;

// Bucket the live document's checked items by local day over the trailing
// window. `checkedAt` is stamped by the framework's `toggleNode` on every
// false→true flip, so this is pure derivation — nothing extra is stored.
function computeActivity(data: AppData): {
  labels: string[];
  counts: number[];
} {
  const now = new Date();
  const days: Date[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const slotByDay = new Map(days.map((d, i) => [key(d), i]));
  const counts = new Array<number>(days.length).fill(0);
  for (const list of data.lists) {
    if (list.archived) continue;
    for (const item of flattenNodes(list.items)) {
      if (!item.checked || !item.checkedAt || item.archived) continue;
      const slot = slotByDay.get(key(new Date(item.checkedAt)));
      if (slot !== undefined) counts[slot] = (counts[slot] ?? 0) + 1;
    }
  }
  return { labels: days.map((d) => String(d.getDate())), counts };
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
  const { labels, counts } = useMemo(() => computeActivity(data), [data]);
  const byList = useMemo(
    () => computeOpenByList(data, t("stats.other")),
    [data, t],
  );
  const doneInWindow = counts.reduce((sum, n) => sum + n, 0);
  const totalOpen = byList.reduce((sum, s) => sum + s.value, 0);

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
          <h3 className="pt-1 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            {t("stats.activityHeading")}
          </h3>
          {/* Stat tile: the window's headline number + its inline trend. */}
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
            <span className="text-sm text-fg">
              {t("stats.doneInWindow", { n: doneInWindow })}
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
                      {totalOpen}
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
