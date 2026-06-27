<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `search` — a progressive-query matcher and a generic search overlay

Almost every local-first app eventually grows a "find" field. This module is
the reusable part of one, in three layers you can adopt independently:

- **The matcher** (`compileQuery`, `searchItems`, `segmentMatches`,
  `clipAround`) — a pure, domain-agnostic engine. Given a raw query and any
  string, it reports the character ranges that matched and a relevance score.
  No DOM, no React, no knowledge of what you're searching.
- **`Highlighted`** — a tiny renderer that wraps the matched ranges in `<mark>`,
  so a result row shows _why_ it matched.
- **`SearchModal`** — a generic search overlay (full-screen sheet on mobile, a
  centred card from `sm` up) that owns the search field and the empty /
  no-results / invalid-regex states, and delegates the actual result rows to
  you via a render prop. Generic over your result type, so it imports no domain
  types.

```ts
import {
  compileQuery,
  searchItems,
  segmentMatches,
  clipAround,
  Highlighted,
  SearchModal,
  type CompiledQuery,
  type MatchRange,
  type TextMatch,
} from "@niclaslindstedt/oss-framework/search";
```

The query language is **progressive**, so a casual typist and a power user
share one field:

| You type     | You get                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `milk`       | case-insensitive substring; falls back to a fuzzy subsequence                |
| `grcl`       | fuzzy — letters in order, not adjacent (`grcl` → "**gr**o**c**ery **l**ist") |
| `f*o`, `f?o` | shell wildcards (`*` = any run, `?` = any single character)                  |
| `/\d{4}/i`   | a JavaScript regex (a malformed one is reported, not silently empty)         |

## What it owns vs. what stays in your app

The matcher ranks **one string at a time**. What you index (notes, list items,
contacts), how you project each record to its searchable text, and how you
group or navigate the hits are your app's concern — exactly the store seam
every other module draws.

| In the framework                                         | In your app                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| the query language + per-string matching + scoring       | the corpus: what records exist and their searchable text          |
| `segmentMatches` / `Highlighted` / `clipAround`          | grouping the hits (per list, per folder) and ordering the groups  |
| `SearchModal` chrome (field, empty states, result count) | the result rows (`children` render prop) and what a tap navigates |
| English default labels                                   | translated labels, and the open/close state                       |

## Generic usage

### 1. The matcher, standalone

Compile the query **once** when the user's input changes, then test every
record — far cheaper than re-parsing per record, and safe to memoise on the raw
string.

```ts
const q = compileQuery(query); // { source, isEmpty, invalidRegex, match() }
if (!q.isEmpty && !q.invalidRegex) {
  for (const note of notes) {
    const m = q.match(note.title); // TextMatch | null → { ranges, score }
    if (m) hits.push({ note, ...m });
  }
}
```

For the common flat "rank these records, best first" case, `searchItems` wraps
that loop:

```ts
const ranked = searchItems(notes, (n) => n.title, query);
//    ^ RankedMatch<Note>[] — sorted by score desc, non-matches dropped
```

Pass a pre-`compileQuery`'d query to share one compile across several
`searchItems` calls (e.g. one per field).

### 2. Highlighting a hit

```tsx
<Highlighted text={note.title} ranges={match.ranges} />
```

For a long body field, clip it to a window around the first match before
highlighting, so a multi-paragraph hit shows a focused snippet:

```tsx
const { text, ranges } = clipAround(note.body, match.ranges, 160);
<Highlighted text={text} ranges={ranges} />;
```

### 3. The overlay

`SearchModal` owns the field and the state machine; you pass a **stable**
`search` closure (memoise your index app-side) and render the rows. Call the
`close` argument from a row after navigating to the picked result.

```tsx
// Build the index once, off your document; memoise so `search` stays stable.
const index = useMemo(() => buildIndex(doc), [doc]);
const search = useCallback(
  (query: string) => runSearch(index, query), // → { results, invalidRegex }
  [index],
);

<SearchModal
  open={open}
  onClose={() => setOpen(false)}
  search={search}
  onQueryChange={(q) => q && unlock("seeker")} // analytics / achievement seam
  labels={{ title: t("search.title") /* …translate the rest… */ }}
>
  {(results, close) =>
    results.map((group) => (
      <ResultGroup
        key={group.id}
        group={group}
        onSelect={() => {
          select(group.id);
          close();
        }}
      />
    ))
  }
</SearchModal>;
```

`results` is whatever your `search` returns; the modal only reads
`results.length` for the count header and renders `children(results, close)`
below it. The empty (untyped), no-results, and invalid-regex states are handled
for you.

### The full label set

Every visible string is overridable; English defaults ship. `noResults` and
`matches` are functions so you can interpolate / pluralise.

```ts
type SearchModalLabels = {
  title;
  placeholder;
  clear;
  close;
  prompt;
  hint;
  invalidRegex;
  noResults: (query: string) => string;
  matches: (n: number) => string;
};
```

## Adapting to your app

A new app's needs won't match the defaults exactly. The common cases:

- **You only need to rank a flat list** (a command palette, a tag picker).
  Skip the grouping entirely: feed `searchItems` your records and render the
  returned order. The modal's `results` is then just `RankedMatch<T>[]`.
- **You group hits** (per list, per folder, per note). Drive `compileQuery`
  yourself, accumulate matches into your own group shape, score each group by
  its best hit, and sort — `search` returns `{ results: Group[] }`. This is the
  shape the demo uses (results grouped per list).
- **You don't want the fuzzy fallback / wildcards / regex.** The query language
  is fixed (it's what makes one field serve everyone), but you can pre-filter:
  if a power-user syntax is undesirable, sanitise the raw string before
  `compileQuery`, or just document the field as plain text — a user who never
  types `*` `?` `/` only ever gets substring + fuzzy.
- **You want a different highlight style.** Pass `markClassName` to
  `Highlighted`, or call `segmentMatches` directly and render the runs yourself.
- **A different count, or no count header.** The modal shows
  `labels.matches(results.length)`. If your "N matches" means something other
  than the number of top-level results, render your own count inside `children`
  and set `labels.matches` to a constant (or empty string).
- **Searching async / deferred fields.** The matcher is synchronous over
  strings already in memory. If a field is loaded lazily (e.g. an encrypted
  body), index a cheap projection you _do_ have in memory (a stored preview)
  instead — `buildIndex` is yours, so feed it whatever text is available
  without blocking on a decrypt.

## Verification

- `compileQuery("milk").match("Oat milk")` returns ranges over `milk`;
  `compileQuery("grcl").match("grocery list")` matches fuzzily; a malformed
  `/(/` sets `invalidRegex`.
- In the running app: open the overlay, type a partial term, and confirm the
  matched characters are highlighted in the rows and that picking a result
  navigates and closes. An empty field shows the prompt; a no-match query shows
  the no-results line; `/(/` shows the invalid-regex line.
