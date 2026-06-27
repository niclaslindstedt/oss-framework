// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  compileQuery,
  type MatchRange,
} from "@niclaslindstedt/oss-framework/search";
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

import type { AppData } from "./types.ts";

// The app side of the search seam: the framework owns the matcher (the query
// language, per-string matching, scoring, highlighting) and the overlay chrome;
// this file owns the *corpus* — what gets indexed (each list's title and its
// items, walked recursively) and how the hits are grouped (per list). The
// framework's `compileQuery` is parsed once per query, then run against every
// string here.

/** One matched item within a list group. */
export type ItemHit = {
  id: string;
  label: string;
  ranges: MatchRange[];
  depth: number;
};

/** All matches within one list, ready to render as a group. */
export type ListResult = {
  listId: string;
  title: string;
  /** Ranges within the list title when it matched, else null. */
  titleRanges: MatchRange[] | null;
  items: ItemHit[];
  /** Best single-match score in the group — drives result ordering. */
  score: number;
};

export type SearchOutcome = {
  results: ListResult[];
  invalidRegex: boolean;
};

/**
 * Run `raw` against the document, grouping the hits per list. A list-title hit
 * fills `titleRanges` (and surfaces the list a little higher); item hits fill
 * `items`. Archived lists are skipped — a result navigates to the live list.
 */
export function runSearch(data: AppData, raw: string): SearchOutcome {
  const q = compileQuery(raw);
  if (q.isEmpty) return { results: [], invalidRegex: false };
  if (q.invalidRegex) return { results: [], invalidRegex: true };

  const results: ListResult[] = [];
  for (const list of data.lists) {
    if (list.archived) continue;

    let titleRanges: MatchRange[] | null = null;
    let score = 0;
    const nameMatch = q.match(list.title);
    if (nameMatch) {
      titleRanges = nameMatch.ranges;
      // A title hit is worth a little extra so the list surfaces near the top.
      score = Math.max(score, nameMatch.score + 50);
    }

    const items: ItemHit[] = [];
    const walk = (nodes: readonly ChecklistNode[], depth: number) => {
      for (const node of nodes) {
        // The demo authors every label as a string; the framework's node type
        // widens `label` to `ReactNode`, so guard before searching its text.
        if (typeof node.label === "string") {
          const m = q.match(node.label);
          if (m) {
            items.push({
              id: node.id,
              label: node.label,
              ranges: m.ranges,
              depth,
            });
            score = Math.max(score, m.score);
          }
        }
        if (node.children) walk(node.children, depth + 1);
      }
    };
    walk(list.items, 0);

    if (titleRanges || items.length > 0) {
      results.push({
        listId: list.id,
        title: list.title,
        titleRanges,
        items,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { results, invalidRegex: false };
}
