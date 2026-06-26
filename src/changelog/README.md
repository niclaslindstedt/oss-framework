<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/changelog`

A self-contained **"What's new" dialog** for local-first PWAs. It parses a
[Keep a Changelog](https://keepachangelog.com)-formatted `CHANGELOG.md` into a
typed release list and renders it as a modal, newest release first. A changelog
bullet can carry a `[Learn more](feature:<slug>)` link that drills into a
long-form **feature doc** in place, with a back button.

It pairs with the release tooling under
[`scripts/release/`](../../scripts/release) — the changeset fragments the
collator turns into the very `CHANGELOG.md` sections this module reads. The two
are independent (you can adopt either alone), but they are designed to compose:
fragments → collated CHANGELOG → this dialog.

## What it owns vs. what stays in your app

| The module owns                                                                             | Your app owns                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Parsing `CHANGELOG.md` (`parseChangelog`) and feature docs (`parseFeatureDoc`)              | **Pulling the markdown into the bundle.** A Vite app inlines `CHANGELOG.md?raw` and globs `docs/features/*.md?raw`. |
| The accessible modal: overlay, Escape/backdrop close, scroll lock, focus, back/close glyphs | **Where the open button lives** (a menu row, a footer link) and the `open` / `onClose` state.                       |
| Rendering changelog/feature-doc markdown to XSS-safe React (no `dangerouslySetInnerHTML`)   | The CSS that gives the theme colour slots their values (see the `theme` module).                                    |

The seam is deliberate: the framework never imports a bundler-specific
`import.meta.glob`, so it stays build-tool-agnostic. Your app does the inlining
and hands the module plain data.

## The contract it imposes

- **Peer dependency:** `react` and `react-dom` (the modal portals to
  `document.body` via `react-dom`).
- **Theme CSS classes.** Every styled element uses the framework theme's
  semantic utility classes — `bg-surface`, `bg-surface-3`, `text-fg`,
  `text-fg-bright`, `text-muted`, `text-link`, `border-line`, and the per-kind
  accents `text-positive` / `text-accent` / `text-success` / `text-negative` /
  `text-danger`. If you use the `theme` module these already resolve. If you do
  not, either map those classes to your own colours or pass `typeColors` /
  restyle. The dialog renders and is fully usable without them — it just won't
  be themed.
- **`feature:<slug>` links** in changelog/doc markdown are intercepted, not
  navigated. A `slug` with no entry in `featureDocs` renders as inert text.

## Install & quick start

```bash
npm i @niclaslindstedt/oss-framework
```

```tsx
import { useState } from "react";
import {
  ChangelogModal,
  parseChangelog,
  buildFeatureDocs,
} from "@niclaslindstedt/oss-framework/changelog";

// Inline the markdown at build time (Vite shown; adapt to your bundler).
import changelogMd from "../CHANGELOG.md?raw";
const RELEASES = parseChangelog(changelogMd);
const FEATURE_DOCS = buildFeatureDocs(
  import.meta.glob("../docs/features/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>What's new</button>
      <ChangelogModal
        open={open}
        onClose={() => setOpen(false)}
        releases={RELEASES}
        featureDocs={FEATURE_DOCS}
      />
    </>
  );
}
```

## API

| Export                                                                                                         | Kind              | Purpose                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| `ChangelogModal`                                                                                               | component         | The dialog. Props below.                                                       |
| `parseChangelog(md)`                                                                                           | `() => Release[]` | Parse Keep-a-Changelog markdown into the `releases` array.                     |
| `parseFeatureDoc(slug, md)`                                                                                    | pure              | Split one feature doc into `{ slug, title, body }`.                            |
| `buildFeatureDocs(raw)`                                                                                        | pure              | Turn a `{ path: markdown }` glob result into the slug-keyed `featureDocs` map. |
| `renderInlineMarkdown` / `renderMarkdownDoc`                                                                   | render helpers    | The internal markdown→React renderers, exported for reuse.                     |
| `FEATURE_LINK_SCHEME`                                                                                          | `"feature:"`      | The link scheme the drill-down intercepts.                                     |
| `DEFAULT_CHANGELOG_LABELS` / `DEFAULT_TYPE_COLORS`                                                             | constants         | The English strings / theme-slot accents the modal falls back to.              |
| `ChangelogRelease`, `ChangelogSection`, `ChangelogEntryType`, `FeatureDoc`, `RenderOptions`, `ChangelogLabels` | types             | The public shapes.                                                             |

### `ChangelogModal` props

| Prop          | Type                                          | Notes                                                            |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `open`        | `boolean`                                     | Renders nothing when false.                                      |
| `onClose`     | `() => void`                                  | Fired by Escape, backdrop click, and the × button.               |
| `releases`    | `readonly ChangelogRelease[]`                 | Usually `parseChangelog(md)`.                                    |
| `featureDocs` | `Record<string, FeatureDoc>` (optional)       | Backs `feature:<slug>` drill-down. Omit to disable it.           |
| `labels`      | `Partial<ChangelogLabels>` (optional)         | Override `heading` / `empty` / `close` / `back` (e.g. for i18n). |
| `typeColors`  | `Partial<Record<ChangelogEntryType, string>>` | Override per-kind accent classes.                                |

## Migration — replacing a home-grown changelog dialog

If your app already inlines `CHANGELOG.md` and renders a "What's new" modal
(the pattern this module was extracted from), the move is mostly **deletion**:

| Before (in your app)                                        | After                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `changelog/parse.ts` (a Keep-a-Changelog parser)            | Delete → `parseChangelog`.                                         |
| `changelog/data.ts` (`import md from "CHANGELOG.md?raw"`)   | Keep the `?raw` import; pass the parsed result as `releases`.      |
| `changelog/feature-docs.ts` (`import.meta.glob` + splitter) | Keep the glob; replace the splitter with `buildFeatureDocs(glob)`. |
| `changelog/render.tsx` (markdown → React)                   | Delete → re-exported `renderInlineMarkdown` / `renderMarkdownDoc`. |
| `ChangelogModal.tsx` wired to your `Modal` + i18n + icons   | Delete the modal; render `<ChangelogModal>` and pass `labels`.     |

The data inlining (`?raw`, `import.meta.glob`) stays yours — it is the one
bundler-specific bit the framework deliberately does not absorb.

## Partial match — reconciling the differences

Most adopters won't line up with the framework exactly. The common cases:

- **Your theme has fewer colour slots.** The modal uses `text-positive` /
  `text-success` / `text-negative` in addition to `text-accent` / `text-danger`
  / `text-muted`. If your CSS lacks those, either add them (recommended — it is
  the framework's converged 18-slot vocabulary; see the `theme` module README)
  or pass `typeColors` mapping each kind onto a class you do define. An app that
  previously folded several kinds onto one colour can reproduce that by pointing
  multiple `typeColors` entries at the same class.
- **Renamed colour variables.** If your slots are named differently
  (`--brand` vs `--accent`), map them in your Tailwind config or pass
  `typeColors` with your own class names.
- **You don't use Tailwind / the theme at all.** Every element carries explicit
  classes; target them in your own stylesheet, or accept the unstyled-but-usable
  default. Structure and behaviour don't depend on the theme.
- **You have your own modal system.** This component ships its own overlay and
  does not consume one. If you need it to live inside your modal stack (shared
  Escape ordering, focus trap), render the pieces yourself — `parseChangelog` +
  `renderInlineMarkdown` give you the data and the rendered bullets; wrap them
  in your dialog.
- **Different i18n runtime.** There is no i18n dependency — translate by passing
  `labels`. The Keep-a-Changelog section names (Added / Fixed / …) are not
  translated, matching the source format.
- **A different changelog format.** The parser expects Keep a Changelog
  (`## [version] - date`, `### Added|Changed|Fixed|Removed|Security|Deprecated`,
  `-` bullets). Other formats need a different parser; the modal only needs the
  `ChangelogRelease[]` shape, so you can supply your own.

## Verification

- `parseChangelog(yourMarkdown)` returns your releases newest-first with the
  right dates and sections (unit-testable, no DOM).
- Render `<ChangelogModal open releases={…}/>` and confirm the latest version
  shows; click a `Learn more` link and confirm the doc opens and Back returns.
- Confirm the colour accents resolve (the section labels are tinted) — if they
  are not, your theme CSS is missing the slots above.
