// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public surface of the changelog module, available under the
// "@niclaslindstedt/oss-framework/changelog" subpath. A "What's new" dialog
// that parses a Keep-a-Changelog `CHANGELOG.md` and renders it, with an
// inline "Learn more" drill-down into long-form feature docs.
//
// Pairs with the release tooling under `scripts/release/` (the changeset
// fragments the collator turns into the CHANGELOG sections this reads) — see
// the module README.

export {
  ChangelogModal,
  DEFAULT_CHANGELOG_LABELS,
  DEFAULT_TYPE_COLORS,
  type ChangelogLabels,
} from "./ChangelogModal.tsx";
export {
  parseChangelog,
  type ChangelogEntryType,
  type ChangelogRelease,
  type ChangelogSection,
} from "./parse.ts";
export {
  buildFeatureDocs,
  parseFeatureDoc,
  type FeatureDoc,
} from "./feature-docs.ts";
export {
  renderInlineMarkdown,
  renderMarkdownDoc,
  FEATURE_LINK_SCHEME,
  type RenderOptions,
} from "./render.tsx";
