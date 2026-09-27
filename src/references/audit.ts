// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The registry held to the code that cites it — OSS_SPEC.md §24.3's four
// rules, as a function an app's own test calls:
//
//   1. every `[ref:<id>]` tag names an entry;
//   2. every entry is cited somewhere;
//   3. each entry's `usedBy` lists exactly the files that cite it;
//   4. each entry is complete — enough to find the source again, the kind of
//      evidence it is, and the words the number was taken from.
//
// Plus the two optional fields §24.2 gives a shape — a `summary` keyed by
// language tag, a list of kebab-case `topics` — held to it whenever they are
// present, and, when asked, the app's own vocabulary: a `summary` in each of
// its languages and at least one of its `topics`.
//
// Pure and file-system free: the caller reads its source tree (in a node
// test, with `node:fs`) and hands in path → text. An empty result is a
// registry in step with the code; `expect(auditReferences(…)).toEqual([])`
// prints every problem at once when it is not.

import {
  CITATION_TAG,
  EVIDENCE,
  REFERENCE_ID,
  type Registry,
} from "./registry.ts";

/** A BCP 47 language tag, loosely — `en`, `sv`, `pt-BR`. */
const LANGUAGE_TAG = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

export type ReferenceRule =
  /** A tag in the code names no entry. */
  | "unresolved"
  /** An entry no file cites. */
  | "uncited"
  /** An entry's `usedBy` is not exactly the files that cite it. */
  | "used-by"
  /** A required field is missing or ill-formed. */
  | "incomplete"
  /** A `summary` out of shape, or missing one of the app's languages. */
  | "summary"
  /** `topics` out of shape, empty, or naming a topic the app lacks. */
  | "topics";

export type ReferenceProblem = {
  rule: ReferenceRule;
  /** The entry, or the id an unresolved tag names. */
  id: string;
  message: string;
};

export type AuditOptions = {
  /** Require a non-empty `summary` in each of these languages. */
  languages?: readonly string[];
  /** Require at least one topic on every entry, each one of these. */
  topics?: readonly string[];
};

/** Which files cite which ids: id → the citing paths, sorted. `sources` is
 *  path → file text; pass only the files the tags may live in (the source
 *  tree, not tests or build output). */
export function findCitations(
  sources: Readonly<Record<string, string>>,
): Map<string, string[]> {
  const byId = new Map<string, Set<string>>();
  for (const [path, text] of Object.entries(sources)) {
    for (const match of text.matchAll(CITATION_TAG)) {
      const id = match[1]!;
      let files = byId.get(id);
      if (!files) byId.set(id, (files = new Set()));
      files.add(path);
    }
  }
  return new Map(
    [...byId].map(([id, files]) => [id, [...files].sort()] as const),
  );
}

/** Every way the registry and the code disagree, or an entry falls short —
 *  empty when they are in step. */
export function auditReferences(
  registry: Registry<string>,
  sources: Readonly<Record<string, string>>,
  options: AuditOptions = {},
): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  const entries = registry.references ?? {};
  const cited = findCitations(sources);

  for (const [id, files] of cited) {
    if (!Object.hasOwn(entries, id)) {
      problems.push({
        rule: "unresolved",
        id,
        message: `[ref:${id}] in ${files.join(", ")} names no entry`,
      });
    }
  }

  for (const [id, entry] of Object.entries(entries)) {
    const files = cited.get(id) ?? [];
    const usedBy = Array.isArray(entry.usedBy)
      ? [...entry.usedBy].sort()
      : null;

    if (files.length === 0) {
      problems.push({
        rule: "uncited",
        id,
        message: `${id}: no file cites it`,
      });
    }
    if (usedBy === null) {
      problems.push({
        rule: "incomplete",
        id,
        message: `${id}: usedBy is not a list`,
      });
    } else if (files.length > 0 && !sameList(usedBy, files)) {
      problems.push({
        rule: "used-by",
        id,
        message: `${id}: usedBy is [${usedBy.join(", ")}], the tags are in [${files.join(", ")}]`,
      });
    }

    for (const field of incomplete(id, entry)) {
      problems.push({ rule: "incomplete", id, message: `${id}: ${field}` });
    }

    const languages = options.languages ?? [];
    for (const message of summaryShape(entry.summary, languages)) {
      problems.push({ rule: "summary", id, message: `${id}: ${message}` });
    }
    for (const lang of languages) {
      if (!isRecord(entry.summary) || !Object.hasOwn(entry.summary, lang)) {
        problems.push({
          rule: "summary",
          id,
          message: `${id}: no summary in "${lang}"`,
        });
      }
    }

    const topics = entry.topics;
    if (topics !== undefined && !Array.isArray(topics)) {
      problems.push({
        rule: "topics",
        id,
        message: `${id}: the topics are not a list`,
      });
    } else if (options.topics) {
      if (!topics?.length) {
        problems.push({ rule: "topics", id, message: `${id}: no topics` });
      }
      for (const topic of topics ?? []) {
        if (!options.topics.includes(topic)) {
          problems.push({
            rule: "topics",
            id,
            message: `${id}: unknown topic "${topic}"`,
          });
        }
      }
    } else if (topics) {
      if (topics.length === 0) {
        problems.push({
          rule: "topics",
          id,
          message: `${id}: the topics list is empty`,
        });
      }
      for (const topic of topics) {
        if (typeof topic !== "string" || !REFERENCE_ID.test(topic)) {
          problems.push({
            rule: "topics",
            id,
            message: `${id}: the topic "${String(topic)}" is not kebab-case`,
          });
        }
      }
    }
  }

  return problems;
}

/** What is missing or ill-formed in one entry, as short phrases. */
function incomplete(
  id: string,
  entry: Registry<string>["references"][string],
): string[] {
  const out: string[] = [];
  if (!REFERENCE_ID.test(id)) out.push("the id is not kebab-case");
  if (!nonEmpty(entry.title)) out.push("no title");
  if (!Number.isInteger(entry.year)) out.push("the year is not an integer");
  if (!(entry.authors?.length || nonEmpty(entry.organization))) {
    out.push("no authors or organization");
  }
  if (!(entry.doi || entry.url || entry.isbn)) {
    out.push("no doi, url or isbn to find it by");
  }
  if (entry.doi && !/^10\.\d{4,}\/\S+$/.test(entry.doi)) {
    out.push(`the doi "${entry.doi}" is not a bare 10.xxxx/… DOI`);
  }
  if (entry.url && !/^https:\/\//.test(entry.url)) {
    out.push(`the url "${entry.url}" is not https://`);
  }
  if (entry.accessed && !/^\d{4}-\d{2}-\d{2}$/.test(entry.accessed)) {
    out.push(`accessed "${entry.accessed}" is not YYYY-MM-DD`);
  }
  if (entry.language !== undefined && !LANGUAGE_TAG.test(entry.language)) {
    out.push(`the language "${entry.language}" is not a BCP 47 tag`);
  }
  if (!(EVIDENCE as readonly string[]).includes(entry.evidence)) {
    out.push(
      `the evidence "${String(entry.evidence)}" is not in the vocabulary`,
    );
  }
  if (!Array.isArray(entry.quotes) || entry.quotes.length === 0) {
    out.push("no quotes");
  } else if (entry.quotes.some((q) => !nonEmpty(q?.text))) {
    out.push("a quote with no text");
  }
  if (!nonEmpty(entry.supports)) out.push("no supports");
  return out;
}

/** What is out of shape in a `summary`, when there is one: it is an object,
 *  keyed by language tag, of non-empty lines. An empty object is only named
 *  when no languages are required — each missing one is named instead. */
function summaryShape(
  summary: unknown,
  languages: readonly string[],
): string[] {
  if (summary === undefined) return [];
  if (!isRecord(summary)) return ["the summary is not keyed by language"];
  const out: string[] = [];
  const entries = Object.entries(summary);
  if (entries.length === 0 && languages.length === 0) {
    out.push("the summary has no language");
  }
  for (const [lang, line] of entries) {
    if (!LANGUAGE_TAG.test(lang)) {
      out.push(`the summary key "${lang}" is not a BCP 47 tag`);
    } else if (!nonEmpty(line)) {
      out.push(`the summary in "${lang}" is empty`);
    }
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
