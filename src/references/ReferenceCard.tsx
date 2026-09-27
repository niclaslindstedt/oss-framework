// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { formatDayKey } from "../calendar/format.ts";
import { ExternalLinkIcon } from "../components/icons.tsx";
import {
  byline,
  publication,
  referenceSummary,
  sourceLink,
  type Evidence,
  type Reference,
} from "./registry.ts";

// One source, cited the way a reference list cites it: the kind of evidence
// and the year, the title in the source's own language, who and where, the
// app's line on what rests on it, and — one tap down, in a native
// `<details>` — the source's own words the numbers were taken from, so the
// claim can be checked against them. Then the way to open it: the DOI, else
// the URL, else the ISBN to look it up by, and when a web page was read.
//
// The link out is user-initiated navigation and nothing is prefetched
// (OSS_SPEC.md §24.4). The card writes nothing. What surrounds it — the
// heading, the grouping by topic (`byTopic`), the disclaimer — is the app's.

/** Visible strings the card needs. All optional — English defaults fill in
 *  any you omit. */
export type ReferenceCardLabels = {
  /** The disclosure over the quotes. Default `"What the app took from it"`. */
  quotes?: string;
  /** The link text for a source with a URL and no DOI (a DOI is shown as
   *  itself). Default `"Open the source"`. */
  openSource?: string;
  /** A book with no link. Default `ISBN <isbn>`. */
  isbn?: (isbn: string) => string;
  /** When a web page was read, already formatted. Default `Read <date>`. */
  accessed?: (date: string) => string;
  /** The evidence chip, per kind. Missing kinds fall back to English. */
  evidence?: Partial<Record<Evidence, string>>;
};

export const DEFAULT_EVIDENCE_LABELS: Record<Evidence, string> = {
  guideline: "Guideline",
  consensus: "Consensus statement",
  "systematic-review": "Systematic review",
  "meta-analysis": "Meta-analysis",
  "randomized-trial": "Randomized trial",
  cohort: "Cohort study",
  "clinical-study": "Clinical study",
  review: "Review",
  method: "Method",
  dataset: "Reference data",
  "health-service": "Health service advice",
};

export type ReferenceCardProps = {
  reference: Reference<string>;
  /** The UI language: picks the entry's `summary`, falling back to
   *  `fallbackLanguages` and then to its `supports`. */
  lang?: string;
  fallbackLanguages?: readonly string[];
  /** Formats the `accessed` day. Default: `Intl`'s `"27 Sept 2026"` shape. */
  locale?: string;
  labels?: ReferenceCardLabels;
  /** Replaces the card's skin (border, surface, padding, radius). */
  className?: string;
};

const CARD_CLASS = "rounded-2xl border border-line bg-surface-3 p-4";

export function ReferenceCard({
  reference: ref,
  lang = "en",
  fallbackLanguages = ["en"],
  locale,
  labels = {},
  className = CARD_CLASS,
}: ReferenceCardProps) {
  const link = sourceLink(ref);
  const where = publication(ref);
  const evidence =
    labels.evidence?.[ref.evidence] ??
    DEFAULT_EVIDENCE_LABELS[ref.evidence] ??
    ref.evidence;

  return (
    <article className={className}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
          {evidence}
        </span>
        <span className="text-muted">{ref.year}</span>
      </div>
      <p
        lang={ref.language}
        className="mt-2 text-sm leading-snug font-semibold text-fg-bright"
      >
        {ref.title}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted">
        {byline(ref)}
        {where && ` · ${where}`}
      </p>
      <p className="mt-2 text-sm leading-snug text-fg">
        {referenceSummary(ref, lang, fallbackLanguages)}
      </p>

      {ref.quotes.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-accent">
            {labels.quotes ?? "What the app took from it"}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {ref.quotes.map((quote, i) => (
              <li key={i}>
                <blockquote
                  lang={ref.language}
                  className="border-l-2 border-line pl-3 text-xs leading-snug text-fg"
                >
                  “{quote.text}”
                </blockquote>
                {quote.at && (
                  <p className="mt-0.5 pl-3 text-[11px] text-muted">
                    {quote.at}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {(link || ref.isbn || ref.accessed) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              {ref.doi
                ? `doi:${ref.doi}`
                : (labels.openSource ?? "Open the source")}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
          {!link && ref.isbn && (
            <span className="text-muted">
              {(labels.isbn ?? ((isbn) => `ISBN ${isbn}`))(ref.isbn)}
            </span>
          )}
          {ref.accessed && (
            <span className="text-muted">
              {(labels.accessed ?? ((date) => `Read ${date}`))(
                formatDayKey(
                  ref.accessed,
                  { day: "numeric", month: "short", year: "numeric" },
                  locale,
                ),
              )}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
