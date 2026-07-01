// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  compileQuery,
  clipAround,
  type MatchRange,
} from "@niclaslindstedt/oss-framework/search";
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

import type { AppData } from "./types.ts";

// The app side of the search seam: the framework owns the matcher (the query
// language, per-string matching, scoring, highlighting) and the overlay chrome;
// this file owns the *corpus* — what gets indexed and how the hits are grouped
// (per list). A checklist contributes its title and every item (walked
// recursively); a note contributes its title and its Markdown `body`, surfaced
// as a clipped snippet. The framework's `compileQuery` is parsed once per query,
// then run against every string here.

/** One matched item within a list group. */
export type ItemHit = {
  id: string;
  label: string;
  ranges: MatchRange[];
  depth: number;
};

/** A matched note body, clipped to a window around the first hit. */
export type BodyHit = {
  /** The clipped snippet (with ellipses where text was dropped). */
  text: string;
  /** Ranges within `text` (already shifted to suit the clip). */
  ranges: MatchRange[];
};

/** All matches within one list, ready to render as a group. */
export type ListResult = {
  listId: string;
  title: string;
  /** Ranges within the list title when it matched, else null. */
  titleRanges: MatchRange[] | null;
  items: ItemHit[];
  /** A note body hit, clipped to a snippet — null for a checklist or an
   *  unmatched body. */
  body: BodyHit | null;
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

    // A note holds its text in `body`, not `items`; index it so a term buried
    // in the Markdown surfaces the note. Clip the hit to a snippet so a
    // multi-paragraph body shows a focused window, not the whole document.
    let body: BodyHit | null = null;
    if (list.kind === "note" && list.body) {
      const m = q.match(list.body);
      if (m) {
        body = clipAround(list.body, m.ranges);
        score = Math.max(score, m.score);
      }
    }

    if (titleRanges || items.length > 0 || body) {
      results.push({
        listId: list.id,
        title: list.title,
        titleRanges,
        items,
        body,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { results, invalidRegex: false };
}
