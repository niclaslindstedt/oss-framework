// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A pure, domain-agnostic full-text matcher. No DOM, no I/O, no React — given a
// raw query and any string, it reports the character ranges that matched and a
// relevance score, so a UI can highlight the hit and an app can rank its own
// records. The engine is the reusable heart your app builds a search feature
// over; what it indexes (notes, list items, contacts) and how it groups the
// hits stays your app's concern.
//
// The query language is progressive, so a casual typist and a power user share
// one field:
//   • `/pattern/flags` → a JavaScript regular expression (an invalid one is
//     reported back via `invalidRegex` so the UI can say so rather than
//     silently finding nothing).
//   • a bare term containing `*` or `?` → shell-style wildcards (`*` = any
//     run, `?` = any single character), matched anywhere in the text.
//   • anything else → a plain case-insensitive substring match, and when that
//     finds nothing, a fuzzy subsequence match (the query's letters in order
//     but not necessarily adjacent), so a quick "abbreviation" (`grcl` →
//     "grocery list") still surfaces the row.

/** A half-open `[start, end)` range of matched characters within a text. */
export type MatchRange = [number, number];

/** A successful match: the spans that hit, plus a relevance score (higher
 *  ranks first). Ranges are sorted and non-overlapping. */
export interface TextMatch {
  ranges: MatchRange[];
  score: number;
}

// ── Query parsing ──────────────────────────────────────────────────────

type Matcher =
  | { kind: "regex"; re: RegExp }
  | { kind: "wildcard"; re: RegExp }
  | { kind: "text"; needle: string };

type ParsedQuery =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "matcher"; matcher: Matcher };

const REGEX_LITERAL = /^\/(.+)\/([a-z]*)$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escape a wildcard term, mapping `*`→`.*` and `?`→`.` but escaping the rest. */
function wildcardToRegExp(term: string): RegExp {
  const body = term
    .split("")
    .map((ch) => (ch === "*" ? ".*" : ch === "?" ? "." : escapeRegExp(ch)))
    .join("");
  return new RegExp(body, "giu");
}

function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };

  const asRegex = REGEX_LITERAL.exec(trimmed);
  if (asRegex) {
    const [, body, flags] = asRegex;
    // Force `g` (so `matchAll` walks every hit) and `i` (case-insensitive),
    // keeping any extra flags the user added (e.g. `s`, `u`).
    const wanted = new Set((flags ?? "").split(""));
    wanted.add("g");
    wanted.add("i");
    try {
      return {
        kind: "matcher",
        matcher: { kind: "regex", re: new RegExp(body!, [...wanted].join("")) },
      };
    } catch {
      return { kind: "invalid" };
    }
  }

  if (trimmed.includes("*") || trimmed.includes("?")) {
    return {
      kind: "matcher",
      matcher: { kind: "wildcard", re: wildcardToRegExp(trimmed) },
    };
  }

  return { kind: "matcher", matcher: { kind: "text", needle: trimmed } };
}

// ── Matching ───────────────────────────────────────────────────────────

/** Merge overlapping/adjacent ranges so the UI never double-marks a span. */
function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: MatchRange[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1]!;
    const cur = sorted[i]!;
    if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
    else out.push(cur);
  }
  return out;
}

function matchRegExp(text: string, re: RegExp): TextMatch | null {
  const ranges: MatchRange[] = [];
  // Clone so concurrent uses of a shared RegExp don't fight over lastIndex.
  const g = new RegExp(
    re.source,
    re.flags.includes("g") ? re.flags : re.flags + "g",
  );
  for (const m of text.matchAll(g)) {
    if (m.index === undefined) continue;
    // A zero-width match (e.g. `a*`) can't be highlighted and would loop —
    // skip it but still count the entry as a (weak) hit.
    if (m[0].length === 0) continue;
    ranges.push([m.index, m.index + m[0].length]);
  }
  if (ranges.length === 0) return null;
  const merged = mergeRanges(ranges);
  // Earlier + more matches rank higher.
  const score = 600 - Math.min(merged[0]![0], 500) + merged.length;
  return { ranges: merged, score };
}

function matchSubstring(text: string, needle: string): TextMatch | null {
  const haystack = text.toLowerCase();
  const lowNeedle = needle.toLowerCase();
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(lowNeedle, from);
    if (idx === -1) break;
    ranges.push([idx, idx + lowNeedle.length]);
    from = idx + lowNeedle.length;
  }
  if (ranges.length === 0) return null;
  // A whole-text or word-start match scores best; otherwise earlier is better.
  const first = ranges[0]![0];
  const wholeWord = first === 0 || /\s/.test(text[first - 1] ?? "");
  const score =
    1000 - Math.min(first, 500) + (wholeWord ? 200 : 0) + ranges.length;
  return { ranges: mergeRanges(ranges), score };
}

/**
 * Fuzzy subsequence: every character of `needle` appears in `text` in order
 * (not necessarily adjacent). Highlights each matched character and scores by
 * how tightly packed the run is, so `grcl` ranks "grocery list" above a
 * scattered coincidence. Single-character queries don't fuzzy-match (too
 * noisy) — the substring pass already covers those.
 */
function matchFuzzy(text: string, needle: string): TextMatch | null {
  if (needle.length < 2) return null;
  const haystack = text.toLowerCase();
  const lowNeedle = needle.toLowerCase();
  const ranges: MatchRange[] = [];
  let ti = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let ni = 0; ni < lowNeedle.length; ni++) {
    const ch = lowNeedle[ni]!;
    if (ch === " ") continue; // spaces in the query are separators, not chars
    let found = -1;
    while (ti < haystack.length) {
      if (haystack[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return null;
    if (firstIdx === -1) firstIdx = found;
    lastIdx = found;
    // Extend a contiguous range rather than emitting one per character.
    const last = ranges[ranges.length - 1];
    if (last && last[1] === found) last[1] = found + 1;
    else ranges.push([found, found + 1]);
  }
  if (ranges.length === 0) return null;
  const span = lastIdx - firstIdx + 1;
  const compactness = Math.max(0, 200 - (span - lowNeedle.length) * 8);
  const score = 100 + compactness - Math.min(firstIdx, 100);
  return { ranges: mergeRanges(ranges), score };
}

function matchWith(text: string, matcher: Matcher): TextMatch | null {
  switch (matcher.kind) {
    case "regex":
    case "wildcard":
      return matchRegExp(text, matcher.re);
    case "text":
      return (
        matchSubstring(text, matcher.needle) ?? matchFuzzy(text, matcher.needle)
      );
  }
}

// ── Compiled query ─────────────────────────────────────────────────────

/**
 * A raw query parsed once, ready to test many strings. Compile the query when
 * the user's input changes, then call `match(text)` for every record you index
 * — far cheaper than re-parsing per record. The matcher is pure, so it is safe
 * to memoise on the raw query string.
 */
export interface CompiledQuery {
  /** The trimmed source query (`""` when blank). */
  readonly source: string;
  /** True when the trimmed query is empty (no matcher to run). */
  readonly isEmpty: boolean;
  /** True when the query was a `/…/` regex literal that failed to compile. */
  readonly invalidRegex: boolean;
  /** Test one string; `null` when it doesn't match (or the query is empty/invalid). */
  match(text: string): TextMatch | null;
}

const NO_MATCH = { match: () => null };

/** Compile a raw query into a reusable matcher. */
export function compileQuery(raw: string): CompiledQuery {
  const parsed = parseQuery(raw);
  const source = raw.trim();
  if (parsed.kind === "empty") {
    return { source, isEmpty: true, invalidRegex: false, ...NO_MATCH };
  }
  if (parsed.kind === "invalid") {
    return { source, isEmpty: false, invalidRegex: true, ...NO_MATCH };
  }
  const { matcher } = parsed;
  return {
    source,
    isEmpty: false,
    invalidRegex: false,
    match: (text) => matchWith(text, matcher),
  };
}

/** One item that matched, with its match metadata, ready to render or rank. */
export interface RankedMatch<T> {
  item: T;
  match: TextMatch;
}

/**
 * Rank a flat list of items by how well their projected text matches `query`.
 * A convenience over `compileQuery` for the common "search these records and
 * show the best first" case; for grouped results (per list, per folder) drive
 * `compileQuery` yourself and group the hits as your domain needs. Items that
 * don't match are dropped; the rest are sorted by score (descending), ties
 * keeping their original order. Pass a pre-`compileQuery`'d query to share one
 * across several `searchItems` calls.
 */
export function searchItems<T>(
  items: readonly T[],
  getText: (item: T) => string,
  query: string | CompiledQuery,
): RankedMatch<T>[] {
  const compiled = typeof query === "string" ? compileQuery(query) : query;
  if (compiled.isEmpty || compiled.invalidRegex) return [];
  const out: RankedMatch<T>[] = [];
  for (const item of items) {
    const match = compiled.match(getText(item));
    if (match) out.push({ item, match });
  }
  // Stable sort by score: `Array.prototype.sort` is stable in modern engines,
  // so equal scores keep input order.
  return out.sort((a, b) => b.match.score - a.match.score);
}

// ── Highlighting helpers ───────────────────────────────────────────────

/** A run of text tagged as a match (to wrap) or not (to render plain). */
export interface MatchSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into alternating plain / highlighted segments from a set of
 * match ranges, so a renderer can wrap only the matched spans. Ranges are
 * assumed sorted and non-overlapping (as the matcher returns them).
 */
export function segmentMatches(
  text: string,
  ranges: MatchRange[],
): MatchSegment[] {
  if (ranges.length === 0) return [{ text, match: false }];
  const out: MatchSegment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor)
      out.push({ text: text.slice(cursor, start), match: false });
    out.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length)
    out.push({ text: text.slice(cursor), match: false });
  return out;
}

/**
 * Clip a long text down to a window around its first match, shifting the ranges
 * to suit and adding ellipses where text was dropped. Use it before
 * highlighting a body / description field so a multi-paragraph hit shows a
 * focused snippet instead of the whole blob. A short text (or one with no
 * ranges) is returned unchanged.
 */
export function clipAround(
  text: string,
  ranges: MatchRange[],
  width = 160,
): { text: string; ranges: MatchRange[] } {
  if (text.length <= width || ranges.length === 0) {
    return { text, ranges };
  }
  const first = ranges[0]![0];
  // Centre the window on the first match, clamped to the text bounds.
  let start = Math.max(0, first - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  start = Math.max(0, end - width);
  const lead = start > 0 ? "…" : "";
  const trail = end < text.length ? "…" : "";
  const shifted = ranges
    .filter(([s, e]) => e > start && s < end)
    .map(
      ([s, e]) =>
        [
          Math.max(0, s - start) + lead.length,
          Math.max(0, Math.min(end, e) - start) + lead.length,
        ] as MatchRange,
    );
  return { text: lead + text.slice(start, end) + trail, ranges: shifted };
}
