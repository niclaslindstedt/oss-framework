// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Full-text search: a pure, domain-agnostic progressive-query matcher
// (substring → fuzzy → wildcard → regex) with character-range highlighting,
// plus the generic `SearchModal` overlay and a `Highlighted` renderer. The
// engine ranks any string; your app owns what it indexes and how it groups the
// hits. See ./README.md.

export {
  compileQuery,
  searchItems,
  segmentMatches,
  clipAround,
  type MatchRange,
  type TextMatch,
  type CompiledQuery,
  type RankedMatch,
  type MatchSegment,
} from "./matcher.ts";
export { Highlighted } from "./Highlighted.tsx";
export {
  SearchModal,
  type SearchResults,
  type SearchModalLabels,
} from "./SearchModal.tsx";
