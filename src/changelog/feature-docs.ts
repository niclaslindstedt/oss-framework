// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Long-form feature docs the changelog modal can open in place when a
// "Learn more" link is followed. A changelog bullet links to a doc with
// `[Learn more](feature:<slug>)`, where `<slug>` is the doc's filename stem;
// the collator (`scripts/release/collate-changelog.mjs`) emits that link from
// a fragment's `doc:` front-matter. Feature docs are reference prose, not
// chrome.
//
// The framework only owns the *parsing* — splitting a doc into title + body —
// and a helper that turns a `{ path: markdown }` map into the keyed record the
// modal looks slugs up in. Pulling the markdown into the bundle is the host
// app's job (it knows its own build): a Vite app inlines every doc with
//
//   const raw = import.meta.glob("./docs/features/*.md", {
//     query: "?raw", import: "default", eager: true,
//   });
//   const FEATURE_DOCS = buildFeatureDocs(raw);
//
// keeping the framework free of any bundler-specific `import.meta.glob`.

export interface FeatureDoc {
  // Filename stem (`<slug>.md`) — also the `feature:<slug>` link target
  // authored in changelog fragments / CHANGELOG.md.
  slug: string;
  // First `# ` heading in the file, used as the modal's doc-view title.
  title: string;
  // Everything after that heading — the markdown the modal renders.
  body: string;
}

// Split a doc into its title (the leading `# ` heading) and body. The heading
// is consumed so the modal renders it once in the header chrome rather than
// repeating it atop the scrolling body. Falls back to the slug when a doc has
// no leading heading. Pure and DOM-free, so the parsing is unit-testable.
export function parseFeatureDoc(slug: string, md: string): FeatureDoc {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  while (start < lines.length && lines[start]!.trim() === "") start++;
  let title = slug;
  const h1 = /^#\s+(.*)$/.exec(lines[start] ?? "");
  if (h1) {
    title = h1[1]!.trim();
    start++;
  }
  return { slug, title, body: lines.slice(start).join("\n").trim() };
}

// Turn a `{ path: rawMarkdown }` map — typically the result of the host app's
// `import.meta.glob(..., { query: "?raw", eager: true })` — into the
// slug-keyed record the modal looks `feature:<slug>` targets up in. The slug
// is the filename stem of each path, so `./docs/features/storage.md` keys as
// `storage`.
export function buildFeatureDocs(
  rawDocs: Record<string, string>,
): Record<string, FeatureDoc> {
  const out: Record<string, FeatureDoc> = {};
  for (const [path, md] of Object.entries(rawDocs)) {
    const slug = path.replace(/^.*\/([^/]+)\.md$/, "$1");
    out[slug] = parseFeatureDoc(slug, md);
  }
  return out;
}
