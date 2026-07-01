// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import {
  Highlighted,
  SearchModal,
} from "@niclaslindstedt/oss-framework/search";
import {
  ChecklistIcon,
  ChevronRightIcon,
} from "@niclaslindstedt/oss-framework/components";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { runSearch, type ItemHit, type ListResult } from "./search.ts";
import { useT } from "./i18n/index.ts";
import type { ChecklistStore } from "./useChecklistStore.ts";

// The demo's search feature, built over the framework's `SearchModal` + matcher.
// The framework owns the field, the empty/no-results/invalid states, and the
// per-string matching + highlighting; the app owns the corpus (`runSearch`
// groups hits per list) and the result rows. Picking a result selects that list
// and dismisses the overlay (and the phone drawer, via `onNavigate`).

type Props = {
  open: boolean;
  onClose: () => void;
  store: ChecklistStore;
  // Close the phone drawer after navigating (a no-op when the sidebar is docked).
  onNavigate: () => void;
};

export function SearchOverlay({ open, onClose, store, onNavigate }: Props) {
  const t = useT();
  const data = store.data;

  // Memoise on the document so `SearchModal` keeps a stable `search` ref and
  // doesn't recompute the index every keystroke.
  const search = useCallback((query: string) => runSearch(data, query), [data]);

  return (
    <SearchModal<ListResult>
      open={open}
      onClose={onClose}
      search={search}
      // Searching is a feature, so it's a trophy. The unlock bus dedupes, so
      // firing on every keystroke records it only once.
      onQueryChange={(q) => {
        if (q) unlock("seeker");
      }}
      labels={{
        title: t("search.title"),
        placeholder: t("search.placeholder"),
        clear: t("search.clear"),
        close: t("common.close"),
        prompt: t("search.prompt"),
        hint: t("search.hint"),
        invalidRegex: t("search.invalidRegex"),
        noResults: (query) => t("search.noResults", { query }),
        matches: (n) =>
          n === 1
            ? t("search.matchesOne")
            : t("search.matchesOther", { n: String(n) }),
      }}
    >
      {(results, close) =>
        results.map((result) => (
          <ResultGroup
            key={result.listId}
            result={result}
            inListLabel={t("search.inList")}
            onSelect={() => {
              store.setActive(result.listId);
              onNavigate();
              close();
            }}
          />
        ))
      }
    </SearchModal>
  );
}

// One list's group: a header row (the list icon + its title, highlighted if the
// title matched) followed by the matched items, each indented by its tree depth.
// The whole group navigates to the list — the demo has a single list screen, so
// both the header and an item land on the same place.
function ResultGroup({
  result,
  inListLabel,
  onSelect,
}: {
  result: ListResult;
  inListLabel: string;
  onSelect: () => void;
}) {
  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
      >
        <span className="text-accent">
          <ChecklistIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-bright">
          {result.titleRanges ? (
            <Highlighted text={result.title} ranges={result.titleRanges} />
          ) : (
            result.title
          )}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {result.items.map((item) => (
        <ItemRow key={item.id} item={item} onSelect={onSelect} />
      ))}
      {result.body && (
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full cursor-pointer px-4 py-1.5 pl-12 text-left hover:bg-surface-2"
        >
          <span className="line-clamp-2 min-w-0 flex-1 text-sm text-muted">
            <Highlighted text={result.body.text} ranges={result.body.ranges} />
          </span>
        </button>
      )}
      {result.items.length === 0 && !result.body && result.titleRanges && (
        <p className="py-1.5 pr-4 pl-12 text-xs text-muted">{inListLabel}</p>
      )}
    </li>
  );
}

function ItemRow({ item, onSelect }: { item: ItemHit; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ paddingLeft: 28 + item.depth * 16 }}
      className="flex w-full cursor-pointer items-start gap-2 py-1.5 pr-4 text-left hover:bg-surface-2"
    >
      <span className="mt-1 shrink-0 text-muted">
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-sm text-fg">
        <Highlighted text={item.label} ranges={item.ranges} />
      </span>
    </button>
  );
}
