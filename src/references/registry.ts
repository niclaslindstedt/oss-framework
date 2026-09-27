// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The references registry as an app reads it: every published source the
// app's numbers and claims rest on, keyed by the id the code cites as
// `[ref:<id>]` beside the number it supports (OSS_SPEC.md §24). This module
// is the registry's typed face — the entry shape, the evidence vocabulary
// and the order it ranks in, and how an entry is cited on a sources screen.
//
// Two fields are an app's own rather than the spec's, and both are optional
// here: `summary`, the line a user reads about what in the app rests on the
// source, in each of the app's languages; and `topics`, the parts of the app
// it is listed under. What the topics and languages *are* is the app's —
// the types are generic in both.
//
// Pure: the registry is a parameter. Where it lives, how it is bundled and
// when it loads are the caller's (see `useReferences` for the lazy chunk).

/** The kinds of evidence, strongest first — the order a sources screen lists
 *  them in. The vocabulary is OSS_SPEC.md §24.2's. */
export const EVIDENCE = [
  "guideline",
  "consensus",
  "systematic-review",
  "meta-analysis",
  "randomized-trial",
  "cohort",
  "clinical-study",
  "review",
  "method",
  "dataset",
  "health-service",
] as const;

export type Evidence = (typeof EVIDENCE)[number];

/** A citation tag in a comment: `[ref:` and a kebab-case id. Global — use it
 *  with `matchAll`, which clones it, rather than `exec` on the shared one. */
export const CITATION_TAG = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;

/** What a registry id may look like: kebab-case, `<author-or-org>-<year>`
 *  by convention. */
export const REFERENCE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type Quote = {
  /** The source's own words, in its own language. */
  text: string;
  /** Where in the source: a page, a table, a section. */
  at?: string;
};

/** One source, with its id. `Topic` is what the app groups sources under; the
 *  summary's keys are the app's languages. */
export type Reference<Topic extends string = string> = {
  id: string;
  evidence: Evidence;
  title: string;
  year: number;
  authors?: string[];
  organization?: string;
  /** The journal, publisher or site. */
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  /** Bare, `10.xxxx/…` — no resolver prefix. */
  doi?: string;
  /** `https://`. */
  url?: string;
  isbn?: string;
  /** The language of the source and its quotes (a BCP 47 tag). */
  language?: string;
  /** When a web page was read, `YYYY-MM-DD`. */
  accessed?: string;
  quotes: Quote[];
  /** What the app uses the source for, for a contributor. */
  supports: string;
  /** The same, for a user, keyed by the app's language. */
  summary?: Record<string, string>;
  /** What the source is listed under on the sources screen. */
  topics?: Topic[];
  note?: string;
  /** The files that cite the entry, repo-relative. */
  usedBy: string[];
};

/** The file as stored: entries keyed by id. Anything else at the top level
 *  (a `$comment`, a `$schema`) is ignored. */
export type Registry<Topic extends string = string> = {
  references: Record<string, Omit<Reference<Topic>, "id">>;
};

/** Every entry, strongest evidence first, then by who published it and when. */
export function referenceList<Topic extends string = string>(
  registry: Registry<Topic>,
): Reference<Topic>[] {
  return Object.entries(registry.references)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort(
      (a, b) =>
        evidenceRank(a.evidence) - evidenceRank(b.evidence) ||
        leadName(a).localeCompare(leadName(b), "en") ||
        a.year - b.year ||
        a.id.localeCompare(b.id, "en"),
    );
}

/** Where a kind of evidence ranks, `0` strongest. An unknown kind ranks last
 *  rather than first, so a typo cannot promote a source. */
export function evidenceRank(evidence: string): number {
  const at = (EVIDENCE as readonly string[]).indexOf(evidence);
  return at === -1 ? EVIDENCE.length : at;
}

/** The references under each topic, in the order given, with topics that have
 *  none left out. A source two topics rest on is listed under both. */
export function byTopic<Topic extends string>(
  refs: readonly Reference<Topic>[],
  order: readonly Topic[],
): { topic: Topic; refs: Reference<Topic>[] }[] {
  return order
    .map((topic) => ({
      topic,
      refs: refs.filter((r) => r.topics?.includes(topic)),
    }))
    .filter((group) => group.refs.length > 0);
}

/** The topics, of those given, with no reference listed under them yet — the
 *  parts of an app whose code still cites its sources in prose. A sources
 *  screen names them rather than let a short list pass for a whole one. */
export function unlistedTopics<Topic extends string>(
  refs: readonly Reference<Topic>[],
  order: readonly Topic[],
): Topic[] {
  return order.filter((topic) => !refs.some((r) => r.topics?.includes(topic)));
}

/** Who a reference is by: up to three authors, the first and "et al." past
 *  that, or the organization that published it. */
export function byline(ref: Reference<string>): string {
  const authors = ref.authors ?? [];
  if (authors.length === 0) return ref.organization ?? "";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors[0]} et al.`;
}

/** Where it was published, the way a reference list writes it:
 *  `Sleep Medicine Reviews 16(3):213–222`. */
export function publication(ref: Reference<string>): string {
  let out = ref.container ?? "";
  if (ref.volume) {
    out += ` ${ref.volume}`;
    if (ref.issue) out += `(${ref.issue})`;
    if (ref.pages) out += `:${ref.pages}`;
  } else if (ref.pages) {
    out += `, ${ref.pages}`;
  }
  return out.trim();
}

/** Where a reader can open the source: the DOI's resolver when there is a
 *  DOI (it outlives the publisher's URL), else the URL, else nothing — a book
 *  is found by its ISBN. */
export function sourceLink(ref: Reference<string>): string | null {
  if (ref.doi) return `https://doi.org/${ref.doi}`;
  return ref.url ?? null;
}

/** The entry's user-facing line in `lang`, else in the first of `fallbacks`
 *  it has, else its contributor-facing `supports`. */
export function referenceSummary(
  ref: Reference<string>,
  lang: string,
  fallbacks: readonly string[] = [],
): string {
  for (const key of [lang, ...fallbacks]) {
    const line = ref.summary?.[key]?.trim();
    if (line) return line;
  }
  return ref.supports;
}

function leadName(ref: Reference<string>): string {
  return ref.authors?.[0] ?? ref.organization ?? "";
}
