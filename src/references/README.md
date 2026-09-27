<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `references` — the sources behind an app's numbers

An app that compares someone's data with a published recommendation — a growth
curve, a dose, a sleep range, a cycle length — makes a claim every time it
shows a number. [OSS_SPEC.md §24](../../OSS_SPEC.md) asks for the claim to be
checkable: one registry, `docs/references.json`, of every source the numbers
rest on; a `[ref:<id>]` tag in the comment beside each number; a test that
keeps the two in step; and a screen that shows the user the list. This module
is everything in that chain that is not the app's own.

```ts
import {
  auditReferences,
  byTopic,
  ReferenceCard,
  useReferences,
  type Registry,
} from "@niclaslindstedt/oss-framework/references";

type Topic = "sleep" | "growth";

// Module level, so the hook's cache recognises it (see "Loading").
const loadRegistry = () =>
  import("../docs/references.json").then(
    (m) => m.default as unknown as Registry<Topic>,
  );

function Sources() {
  const refs = useReferences(loadRegistry); // null until the chunk lands
  if (!refs) return <p>Loading…</p>;
  return byTopic(refs, ["sleep", "growth"]).map((group) => (
    <section key={group.topic}>
      <h2>{group.topic}</h2>
      {group.refs.map((ref) => (
        <ReferenceCard key={ref.id} reference={ref} lang="en" />
      ))}
    </section>
  ));
}
```

## The registry

`Registry<Topic>` is §24.2's file: `references`, keyed by kebab-case id, each
entry with its `title`, `year`, `authors` or `organization`, a `doi` / `url` /
`isbn`, the `evidence` kind, the verbatim `quotes` the numbers were taken
from, what it `supports`, and the files it is `usedBy`. Two optional fields
are the app's own, and the module reads both:

- **`summary`** — the line a user reads about what in the app rests on the
  source, keyed by language (`{ en: "…", sv: "…" }`). `referenceSummary` picks
  one, with fallbacks, and falls back to `supports` when none is written.
- **`topics`** — the parts of the app the source is listed under. The type is
  generic in them, so a `Topic` union of your trackers or screens checks every
  `byTopic` call.

`referenceList` ranks entries strongest evidence first (`EVIDENCE` is the
vocabulary, in that order), then by lead author or organization, then year.
`byTopic` groups them in the order you give, listing a source under every
topic it serves; `unlistedTopics` names the topics nothing is listed under
yet — so a screen can say which parts of the app still cite in prose, rather
than let a short list pass for a whole one.

`byline`, `publication` and `sourceLink` cite an entry the way a reference
list does: `Galland BC et al.`, `Sleep Medicine Reviews 16(3):213–222`, and
the DOI's resolver ahead of the publisher's URL, because the DOI outlives it.

## The audit

`auditReferences(registry, sources, options?)` is §24.3's four rules as a
function: every tag resolves, every entry is cited, `usedBy` is exact, every
entry is complete. It returns a list of problems — `rule`, `id`, and a
message — and an empty list when the registry and the code agree. Pass
`languages` and `topics` to hold the app's own fields too.

It is pure; reading the source tree is the caller's, so the test is a few
lines of `node:fs`:

```ts
import { readdirSync, readFileSync } from "node:fs";

const sources = Object.fromEntries(
  readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => [`src/${f}`, readFileSync(`src/${f}`, "utf8")]),
);

it("keeps the registry in step with the code", () => {
  expect(
    auditReferences(registry, sources, {
      languages: ["en", "sv"],
      topics: ["sleep", "growth"],
    }),
  ).toEqual([]);
});
```

`findCitations` is the half of it that reads tags: id → the files that cite
it.

## Loading

The registry is a few dozen kilobytes nobody needs until the sources screen
opens, so it belongs in a chunk of its own — bundled with the app, never
fetched from anywhere else (§24.4). `useReferences(load)` takes the app's
loader, calls it once, ranks the result, and serves every later mount from
memory; it is `null` until then. The cache is keyed by the loader function, so
declare it once at module level rather than inline. `loadReferences(load)` is
the same outside a component. A failed load is forgotten, and the next mount
tries again.

## The card

`ReferenceCard` lists one entry: the evidence kind and year, the title (with
the source's `lang`), who and where, the summary in `lang`, the quotes behind a
native `<details>`, and the DOI or URL — or the ISBN when there is nothing to
link — plus when a web page was read, formatted for `locale`. Every visible
string is in `labels`, with English defaults, and the evidence chip's words
per kind in `labels.evidence` (`DEFAULT_EVIDENCE_LABELS` is the English set).
The link is a plain `target="_blank"` anchor: nothing is prefetched, and the
card writes nothing.

## What stays in your app

The registry file and its entries; the topics and languages; where the sources
screen lives and how it is reached; the headings, the grouping and the
disclaimer that belong beside the list (§24.5); and the test that walks your
source tree.
