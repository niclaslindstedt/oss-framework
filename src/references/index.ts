// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public references surface — the OSS_SPEC.md §24 registry of every source an
// app's numbers rest on: its typed face and ranking, the audit that holds it
// to the `[ref:<id>]` tags in the code, a lazy loader, and the card a sources
// screen lists each entry with. See ./README.md.
export {
  byline,
  byTopic,
  CITATION_TAG,
  EVIDENCE,
  evidenceRank,
  publication,
  REFERENCE_ID,
  referenceList,
  referenceSummary,
  sourceLink,
  unlistedTopics,
  type Evidence,
  type Quote,
  type Reference,
  type Registry,
} from "./registry.ts";
export {
  auditReferences,
  findCitations,
  type AuditOptions,
  type ReferenceProblem,
  type ReferenceRule,
} from "./audit.ts";
export { loadReferences, useReferences } from "./useReferences.ts";
export {
  DEFAULT_EVIDENCE_LABELS,
  ReferenceCard,
  type ReferenceCardLabels,
  type ReferenceCardProps,
} from "./ReferenceCard.tsx";
