# OSS Framework

> Shared React components, hooks, and utilities for building local-first PWAs.

[![ci](https://github.com/niclaslindstedt/oss-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/oss-framework/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)

`@niclaslindstedt/oss-framework` is the common foundation behind the
[`notes`](https://github.com/niclaslindstedt/notes) and
[`checklist`](https://github.com/niclaslindstedt/checklist) apps. Both apps
grew the same features in parallel — storage backends, encryption, themes,
folders, namespaces — and copied changes between each other by hand. This
package is where that shared surface is extracted so there is one
implementation to maintain instead of two.

## Why

- **Stop hand-copying.** Features ported between the apps "by hand" live here
  once and are consumed as a dependency.
- **Local-first by design.** A `StorageAdapter` contract lets the same UI sit
  on top of localStorage, a local folder, Dropbox, or Google Drive.
- **PWA-shaped.** Themes, gesture/swipe hooks, modals, and at-rest encryption
  are built for installable, offline, mobile-first web apps.
- **Tree-shakeable.** ESM + CJS output with per-module subpath exports, React
  kept as a peer dependency — no second copy in your bundle.
- **Agent-maintained.** A `find-refactor-candidates` skill ranks what to
  extract from the source apps next (see below).

## Prerequisites

- [Node.js](https://nodejs.org/) 22+ (see `.nvmrc`)
- npm 10+
- React 19 (peer dependency) in the consuming app

## Install

This package is published to the **GitHub Packages** npm registry. Point the
`@niclaslindstedt` scope at GitHub Packages by adding an `.npmrc` to your
project (or `~/.npmrc`):

```
@niclaslindstedt:registry=https://npm.pkg.github.com
```

GitHub Packages requires authentication even for public packages, so add a
[personal access token](https://github.com/settings/tokens) with the
`read:packages` scope as well:

```
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install as usual:

```bash
npm install @niclaslindstedt/oss-framework
```

## Quick start

```tsx
import { useEscapeKey } from "@niclaslindstedt/oss-framework";

function Dropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Closes the dropdown on Escape, but only while it's open. Runs in the
  // capture phase so it wins over an enclosing modal's own Escape handler.
  useEscapeKey(open, onClose);
  return open ? <ul role="listbox">{/* … */}</ul> : null;
}
```

Pull a narrower slice straight from a subpath so your bundler can shake the
rest:

```ts
import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks";
```

## API

The public surface grows as functionality is migrated out of the source apps.
Today:

| Export                   | From                     | Purpose                                                                                                                    |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `useEscapeKey`           | `.` and `./hooks`        | Capture-phase Escape handler gated on an `enabled` flag.                                                                   |
| `useMediaQuery`          | `.` and `./hooks`        | Subscribe to a CSS media query; `useDesktopPointer` gates right-click affordances.                                         |
| `useRowSwipe`            | `.` and `./hooks`        | Swipe-to-reveal / swipe-to-dismiss gesture for a list row.                                                                 |
| `usePullToRefresh`       | `.` and `./hooks`        | Touch pull-to-refresh gesture at a scroll region's top; fires an async `onRefresh`.                                        |
| `useUndoRedoShortcuts`   | `.` and `./hooks`        | Global Cmd/Ctrl+Z · Cmd/Ctrl+Shift+Z / Ctrl+Y bound to a document history.                                                 |
| `useLongPress`           | `.` and `./hooks`        | Press-and-hold gesture; fires past a delay, cancels on drag, swallows the tap.                                             |
| `isModalOpen`            | `.` and `./hooks`        | `true` while any framework dialog (`[aria-modal="true"]`) is mounted — the shared modal gate.                              |
| `useClipboard`           | `.` and `./hooks`        | Copy-to-clipboard with a self-resetting `copied` flag; `copyTextToClipboard` is the pure, React-free write.                |
| `useTypeahead`           | `.` and `./hooks`        | List-box "type to select": printable keys jump to a matching option; `matchPrefixRange` marks the matched characters.      |
| `useRovingTabindex`      | `.` and `./hooks`        | WAI-ARIA roving tabindex for a 1-D listbox / radiogroup / menu — one Tab stop, arrow keys navigate, optional type-ahead.   |
| `useGridRovingTabindex`  | `.` and `./hooks`        | Roving tabindex for a 2-D grid picker — arrows walk rows/columns, Home/End jump to the corners.                            |
| `useApplyTheme`          | `.` and `./theme`        | Projects the chosen appearance onto `<html>` as CSS variables.                                                             |
| theme data               | `.` and `./theme`        | Preset vocabulary, per-preset palettes, `CustomTheme` + helpers.                                                           |
| `SettingsModal`          | `.` and `./theme`        | Self-contained dialog over the appearance picker.                                                                          |
| `AppearancePicker`       | `.` and `./theme`        | Controlled theme / font / colour editor over a `ThemeAppearance`.                                                          |
| `styles.css`             | `./styles.css`           | The framework's stylesheet — token map, flavour CSS, drawer keyframes, and every preset palette. One `@import`.            |
| `installPresetTokens`    | `.` and `./theme`        | Inject the per-preset `[data-theme]` colour blocks at runtime (`PRESET_TOKENS_CSS` for the raw string).                    |
| `ChangelogModal`         | `.` and `./changelog`    | "What's new" dialog over a Keep-a-Changelog `CHANGELOG.md`.                                                                |
| `parseChangelog`         | `.` and `./changelog`    | Parse a `CHANGELOG.md` into the typed release list it renders.                                                             |
| `StorageAdapter`         | `.` and `./storage`      | Byte-level persistence contract for swappable backends.                                                                    |
| storage backends         | `.` and `./storage`      | Browser, local-folder, Dropbox, and Google Drive adapters.                                                                 |
| `createMigrator`         | `.` and `./storage`      | Forward-only document-migration runner (the engine; the chain is yours).                                                   |
| `backoffDelayMs`         | `.` and `./storage`      | Pure save-path retry policy: equal-jitter backoff + retryable-error predicate.                                             |
| `createLogStore`         | `.` and `./logging`      | In-app log ring buffer + capture mirror; the storage sink.                                                                 |
| `LogViewer`              | `.` and `./logging`      | Live Logs panel over a store (filter, copy, clear); `useLogs` hook.                                                        |
| `LogModal`               | `.` and `./logging`      | Modal showing one operation's step log; opened on demand from a status line.                                               |
| `Sidebar`                | `.` and `./sidebar`      | Responsive nav shell: docked sidebar / floating-button drawer.                                                             |
| `FloatingButton`         | `.` and `./sidebar`      | The draggable, edge-resting FAB the shell floats, reusable on its own.                                                     |
| `Modal`                  | `.` and `./components`   | Portalled accessible dialog (backdrop, focus trap, scroll lock).                                                           |
| `Button` / form          | `.` and `./components`   | `Button`, `Checkbox`, `ClearableInput`, `SelectPicker`, `SegmentedControl`.                                                |
| `RowActionMenu`          | `.` and `./components`   | A row's right-click / long-press action menu, floated and anchored to the row.                                             |
| `SwipeableRow`           | `.` and `./components`   | A list row whose two swipe sides are each a button-strip reveal or a flick-to-commit action (glyphs/colours configurable). |
| `Badge` / `Fab`          | `.` and `./components`   | A count pill and a floating action button.                                                                                 |
| `CopyButton`             | `.` and `./components`   | Glyph button that copies a value (string or getter) to the clipboard and flashes a tick; built on `useClipboard`.          |
| settings layout          | `.` and `./components`   | `Section`, `Field`, `ToggleRow` — building blocks for a settings surface.                                                  |
| `CipherGlyph`            | `.` and `./components`   | An "encryptish" busy indicator — re-scrambling cipher glyphs, in place of a spinner.                                       |
| `ConfirmDialog`          | `.` and `./components`   | In-app `window.confirm` replacement — title, message, confirm/cancel, danger tone.                                         |
| `PullToRefreshIndicator` | `.` and `./components`   | Slide-down pill that surfaces the `usePullToRefresh` gesture.                                                              |
| glyph set                | `.` and `./components`   | Dependency-free inline SVG icons, each driven by `className`.                                                              |
| `Checklist`              | `.` and `./checklist`    | Nested checkable list — items, child checklists, cascade, progress, swipe-to-delete.                                       |
| checklist tree           | `.` and `./checklist`    | Pure tree ops: `toggleNode`, `setAllChecked`, `removeNode`, `countProgress`, …                                             |
| glyph picker kit         | `.` and `./glyphs`       | Icon catalogue + `Glyph`, `GlyphPicker`, `ColorPalette`, and a favicon builder.                                            |
| `usePwaUpdate`           | `.` and `./pwa`          | Service-worker update lifecycle singleton: download progress + reload prompt state.                                        |
| `UpdateToast`            | `.` and `./pwa`          | Presentational "a new version is ready" prompt, driven by `usePwaUpdate`.                                                  |
| `CheckForUpdatesItem`    | `.` and `./pwa`          | Presentational "check for updates" footer row — drives `usePwaUpdate().checkForUpdate`.                                    |
| `useStandaloneMobile`    | `.` and `./pwa`          | `true` inside an installed PWA on a phone — gate chrome-hiding affordances.                                                |
| `useAchievementWatcher`  | `.` and `./achievements` | Derives unlocks from state transitions + drains the manual-unlock bus.                                                     |
| achievements UI          | `.` and `./achievements` | `AchievementsModal` (tour), `AchievementUnlockModal`, `TrophyButton` + `unlock`.                                           |
| `withEncryption`         | `.` and `./encryption`   | Wraps any `StorageAdapter` to encipher bytes at rest with a passphrase.                                                    |
| `encryptText` / crypto   | `.` and `./encryption`   | Pure AES-GCM + PBKDF2 envelope round-trip + `isEncryptedEnvelope` sniffers.                                                |
| `createI18n`             | `.` and `./i18n`         | Build a typed, dependency-free `t()` runtime over your catalogs (lazy-loaded langs).                                       |
| `detectBrowserLanguage`  | `.` and `./i18n`         | First-run language detection from `navigator.language` against your supported set.                                         |
| namespace data + ops     | `.` and `./namespaces`   | `Namespace` type + pure list ops (create/rename/restyle/remove, merge, slugify).                                           |
| `NamespacesModal`        | `.` and `./namespaces`   | Manage workspaces — create / switch / rename / restyle / delete; favicon resolver.                                         |
| `SyncStatus`             | `.` and `./sync`         | Header glyph that morphs over a `SaveStatus` + `dirty`/`offline`; opens the details.                                       |
| `SyncDetailsModal`       | `.` and `./sync`         | Sync command centre — status + why, Save now / Reconnect / Reload, location grid.                                          |
| search matcher           | `.` and `./search`       | `compileQuery` / `searchItems` / `segmentMatches` / `clipAround` — progressive query + ranges.                             |
| `SearchModal`            | `.` and `./search`       | Generic search overlay (field + empty states); your rows via a render prop. `Highlighted` too.                             |
| `MarkdownEditor`         | `.` and `./markdown`     | Live-preview Markdown editor (formats every line but the caret's); controlled via `body` + `onChange`.                     |
| Markdown parser          | `.` and `./markdown`     | `classifyLines` / `parseInline` / `shortenUrl` — pure, DOM-free block + inline parse you can render yourself.              |

The `changelog` module is a self-contained "What's new" dialog: it parses a
[Keep a Changelog](https://keepachangelog.com) `CHANGELOG.md` into a typed
release list and renders it as a modal, with an inline "Learn more" drill-down
into long-form feature docs. It is app-agnostic (no i18n runtime, no modal
system, no icon set required) and pairs with the release tooling under
[`scripts/release/`](scripts/release) — the changeset fragments that collate
into the very `CHANGELOG.md` it reads. See
[`src/changelog/README.md`](src/changelog/README.md) for the full API, a
quick-start, and a migration guide.

```ts
import { ChangelogModal } from "@niclaslindstedt/oss-framework/changelog";
```

The `theme` module is the shared theme engine and theme data — the preset
vocabulary, the per-preset palettes, the Custom-theme shape, the webfont
loaders, and the projection that paints them onto `<html>`. It also ships the
appearance UI: `AppearancePicker`, a controlled editor over a `ThemeAppearance`
(theme mode/variant, font, text size, and the Custom colour and shape/motion
controls), and `SettingsModal`, which wraps it in a self-contained accessible
overlay. Feed the same appearance to `useApplyTheme` and the look previews live
as the user picks. The appearance **store** stays in the consuming app.

The module also **ships the styling itself**, so an app doesn't hand-write the
token map, the flavour rules, and every preset's palette: `@import
"@niclaslindstedt/oss-framework/styles.css"` into your Tailwind v4 entry pulls in
the `@theme` token map, the button / control / elevation flavour CSS, the drawer
keyframes, and the `[data-theme="…"]` colour blocks for every built-in preset
(generated from `PRESET_PALETTES` so they never drift). Apps building against
source inject the preset blocks at runtime with `installPresetTokens()` instead.
What stays yours is just app-shell layout. See
[`src/theme/README.md`](src/theme/README.md) for the full API, the styling paths,
and a step-by-step guide to migrating an existing theme implementation onto it
(including how to reconcile a partial match).

```ts
import {
  SettingsModal,
  useApplyTheme,
} from "@niclaslindstedt/oss-framework/theme";
```

```css
@import "tailwindcss";
@import "@niclaslindstedt/oss-framework/styles.css";
```

The `storage` module is the shared persistence layer: one `StorageAdapter` byte
contract and four backends — the browser's `localStorage`, a picked local
folder, Dropbox, and Google Drive — behind a single interface, with their OAuth,
offline-cache, and HTTP plumbing. Adapters move serialized text, not your data
model, so your serialize / parse pipeline stays app-side — and `createMigrator`
runs that text forward through your versioned-document migration chain on load.
See [`src/storage/README.md`](src/storage/README.md) for the full API and
per-backend quick-starts.

```ts
import { createDropboxAdapter } from "@niclaslindstedt/oss-framework/storage";
```

The `logging` module is an in-app **log ring buffer** for PWAs that can't reach
the devtools console (a phone browser tab). `createLogStore` returns an isolated
buffer with an optional, debounced `localStorage` mirror (a "capture" toggle
that survives reloads) and a pub/sub layer a Logs panel renders live; the
loggers it hands out double as the `Logger` sink the `storage` adapters take, so
the same buffer captures your sync diagnostics. The Logs UI and any developer-
mode toggle stay app-side — the framework owns the buffer and the seam
(`setEnabled`) the toggle drives. See
[`src/logging/README.md`](src/logging/README.md) for the full API and migration
guide.

```ts
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";
```

The `sidebar` module is the responsive navigation **shell** both source apps
grew alike around very different content: a draggable floating button and a
swipe-dismissable drawer on phones, a permanent docked sidebar on wide screens.
The host passes its navigation rows as `children` and threads the nav state
(`open` / `position` / `pinned`) in as props — the shell is stateless and owns
only the framing, plus the snap-to-edge geometry and a `useSidebarInset` helper.
A `useEdgeSwipeOpen` hook (the mirror of swipe-to-close) opens the drawer with
an inward edge swipe, for apps that hide the floating button. The draggable,
edge-resting FAB the shell floats is also exported on its own as
`FloatingButton`, so an app can pin a second global action (open Settings, a
composer) from the same primitive. A `usePersistentMenuPosition` hook is a
localStorage-backed drop-in for the `useState` that holds the button's resting
spot, so a dragged-to placement survives a reload. See
[`src/sidebar/README.md`](src/sidebar/README.md) for the prop surface and the
small CSS-token / keyframe contract an app supplies.

```ts
import { Sidebar } from "@niclaslindstedt/oss-framework/sidebar";
```

The `components` module is the shared **UI primitives** — the consistent design
vocabulary an app builds its surfaces from. One implementation of the `Modal`
(portalled, accessible, scroll-locking, stacked-Escape), the `Button` (four
themed variants), the form controls (`Checkbox`, `ClearableInput`), the
`SelectPicker` dropdown (a keyboard-navigable, type-ahead `<select>` replacement
on a portalled `FloatingPanel`), and a dependency-free inline glyph set. Everything
paints through the theme token vocabulary, so the primitives follow the active
theme with no extra wiring; they carry no i18n, no domain types, and no asset
imports (the few user-facing strings inject as props with English defaults). See
[`src/components/README.md`](src/components/README.md) for the full surface and a
migration guide.

```ts
import {
  Modal,
  Button,
  SelectPicker,
} from "@niclaslindstedt/oss-framework/components";
```

The `checklist` module is the **nested checkable list** both source apps grew —
shopping lists, packing lists, task lists with sub-tasks. `Checklist` renders the
depth-indented rows (a child checklist under any item, collapse/expand, drag
grips, checked items struck through and optionally sunk to the bottom, plus
swipe-to-delete when `onDelete` is wired — the `useRowSwipe` gesture in action —
and a per-row right-click handle via `onRowContextMenu` for desktop pointers).
Switch on `editable` to rename a row's text in place (tap to edit), and
`reorderable` to drag rows — a long press or a grip press lifts one to drop
before/after another, even into a child checklist.
`ChecklistProgress` is the header ring badge with a bulk check/uncheck menu; and
`tree.ts` is the pure, DOM-free core — `toggleNode` (cascades a check down the
whole subtree), `setAllChecked`, `removeNode`, `renameNode`, `moveNode`,
`countProgress`, `sortCheckedToBottom` — that an
app can drive its **own** store with. The node type is minimal, so an app
intersects it to carry its own fields (notes, tags, persistence); the framework
owns the tree mechanics and the look. See
[`src/checklist/README.md`](src/checklist/README.md) for the full surface and a
migration guide.

```ts
import {
  Checklist,
  toggleNode,
} from "@niclaslindstedt/oss-framework/checklist";
```

The `glyphs` module is the **"give this thing an icon and a colour" kit** both
apps grew for branding a workspace or list: a dependency-free catalogue of inline
lucide-weight glyphs, a `Glyph` renderer, and the two presentational pickers
(`GlyphPicker`, `ColorPalette`) an app composes into an appearance editor. The
same glyph names feed `glyphDataUri`, which re-badges the favicon to the active
entity's icon. The chosen value lives in the app's store; the framework owns the
catalogue, the rendering, and the picker chrome. See
[`src/glyphs/README.md`](src/glyphs/README.md) for the full surface and a
migration guide.

```ts
import {
  Glyph,
  GlyphPicker,
  ColorPalette,
} from "@niclaslindstedt/oss-framework/glyphs";
```

The `pwa` module is the **service-worker glue** an installable local-first app
needs: `usePwaUpdate` is a singleton that registers the SW (via the optional
`workbox-window` peer dep), tracks the download, and flips a "new version ready"
flag; `UpdateToast` is the presentational prompt that renders it; and
`useStandaloneMobile` reports whether the app is running as an installed PWA (so
chrome-hiding / edge-swipe affordances stay safely off in a normal tab). The app
owns the SW build and where the prompt mounts; the framework owns the lifecycle
and the prompt UI. See [`src/pwa/README.md`](src/pwa/README.md) for the contract
and a migration guide.

```ts
import {
  usePwaUpdate,
  UpdateToast,
  useStandaloneMobile,
} from "@niclaslindstedt/oss-framework/pwa";
```

The `achievements` module turns each feature of your app into an unlockable
trophy across four tiers. It's **generic over your state**: `useAchievementWatcher`
runs your catalog's predicates on every state transition (and drains a manual
`unlock(id)` bus) and records earned ids through your own `record` callback;
`AchievementsModal`, `AchievementUnlockModal`, and `TrophyButton` render the tour,
the unlock celebration, and the count-badged button. Your app keeps the catalog
and the earned-ids store; the framework owns the engine and the UI. See
[`src/achievements/README.md`](src/achievements/README.md) for the contract and
an adoption guide.

```ts
import {
  useAchievementWatcher,
  unlock,
  AchievementsModal,
  AchievementUnlockModal,
  TrophyButton,
  type Achievement,
} from "@niclaslindstedt/oss-framework/achievements";
```

The `encryption` module is **at-rest encryption** for a local-first app: a
passphrase enciphers the document wherever its bytes live, because it sits above
the storage transport. `withEncryption(adapter, passwordRef)` wraps any
`StorageAdapter` so `save` enciphers and `load` decrypts; `encryptText` /
`decryptEnvelope` are the pure AES-GCM + PBKDF2 round-trip over a self-describing
JSON envelope, with `isEncryptedEnvelope` to tell ciphertext from plaintext. The
framework holds the passphrase nowhere — your app collects it and threads it in
by reference, and owns the lock/unlock UI. See
[`src/encryption/README.md`](src/encryption/README.md) for the envelope format
and an adoption guide.

```ts
import {
  withEncryption,
  encryptText,
  decryptEnvelope,
} from "@niclaslindstedt/oss-framework/encryption";
```

The `i18n` module is a tiny, **typed** translation runtime with no third-party
dependency. `createI18n(config)` takes your per-language catalogs and returns a
fully-typed surface — `useT()` (a `t("a.b.c")` whose keys autocomplete and
reject typos), a `LanguageRoot` that mirrors the preference to `localStorage`,
gates the first paint so a returning user never sees a flash of the fallback
language, and keeps `<html lang>` in step, plus `setLanguage` to switch at
runtime. Non-default languages are code-split and loaded on demand. Your app
owns the strings (translation tables diverge per app); the framework owns the
machinery. See [`src/i18n/README.md`](src/i18n/README.md) for the full API and
an adoption guide.

```ts
import { createI18n } from "@niclaslindstedt/oss-framework/i18n";
```

The `namespaces` module models **named buckets that each hold their own
document** — profiles, workspaces, categories. It ships the `Namespace` data
shape, a set of **pure list transforms** over it (create with a unique slug,
rename, restyle, remove, plus a connect-time `mergeNamespaceLists` reconcile), a
favicon resolver that re-badges the tab to the active namespace, and the
`NamespacesModal` management dialog (presentational, labels injected). The
registry and the active-namespace pointer stay in your app — the module is
storage-free by design — so where the list lives and how a slug maps to a
storage location remain yours. See
[`src/namespaces/README.md`](src/namespaces/README.md) for the seam and an
adoption guide.

```ts
import {
  NamespacesModal,
  addNamespace,
  namespaceFaviconHref,
} from "@niclaslindstedt/oss-framework/namespaces";
```

The `sync` module is the **surface over a sync engine**: a header `SyncStatus`
glyph that morphs over a `SaveStatus` union (plus `dirty` / `offline`), and a
`SyncDetailsModal` command centre that spells out _what_ sync is doing and _why_
a save failed, with Save now / Reconnect / Reload / Check connection actions, a
backend + encryption + file-location grid, and an optional collapsible developer
log. It is **purely presentational** — your app's sync engine owns the state
machine and the actions; the module just paints them and gives the user the
buttons. Every action handler is optional, so a local-only app and a
cloud-backed one share the same surface. See
[`src/sync/README.md`](src/sync/README.md) for the contract and an adoption
guide.

```ts
import {
  SyncStatus,
  SyncDetailsModal,
  type SaveStatus,
} from "@niclaslindstedt/oss-framework/sync";
```

The `search` module is the reusable part of a "find" feature, in three layers:
a **pure matcher** (`compileQuery` / `searchItems`) whose progressive query
language (substring → fuzzy → wildcard → `/regex/`) ranks any string and reports
the character ranges that matched; a **`Highlighted`** renderer that wraps those
ranges in `<mark>`; and a generic **`SearchModal`** overlay that owns the field
and the empty / no-results / invalid-regex states while you supply the corpus
search and render the rows. The matcher is domain-agnostic — what you index and
how you group the hits stay yours. See
[`src/search/README.md`](src/search/README.md) for the query language and an
adoption guide.

```ts
import {
  compileQuery,
  Highlighted,
  SearchModal,
} from "@niclaslindstedt/oss-framework/search";
```

The `markdown` module is a live-preview Markdown editor — the Obsidian-style
"format every line except the one you're editing" experience — plus the
dependency-free parser it renders from. `MarkdownEditor` is one self-contained,
**controlled** widget (`body` + `onChange`): it owns the caret/selection/keyboard
plumbing, the mobile soft-keyboard quirks, and copy-as-verbatim-source, while
your app owns the document and where it lives. `classifyLines` / `parseInline` /
`shortenUrl` are exported on their own for any app that wants to classify or
render Markdown without the editor. See
[`src/markdown/README.md`](src/markdown/README.md) for the full API and an
adoption guide.

```tsx
import { MarkdownEditor } from "@niclaslindstedt/oss-framework/markdown";

<MarkdownEditor body={body} onChange={setBody} />;
```

## Demo / preview site

A small Vite app under [`demo/`](demo/) showcases the components, built against
the framework **source** so every deploy reflects the exact commit. It is
published to GitHub Pages at **[framework.niclaslindstedt.se](https://framework.niclaslindstedt.se)**
across three slots:

| URL                                                          | Content                       | Updated on                    |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------- |
| [`/`](https://framework.niclaslindstedt.se/)                 | the latest release (`v*` tag) | each release (else `main`)    |
| [`/preview/`](https://framework.niclaslindstedt.se/preview/) | the current `main`            | every push to `main`          |
| [`/branch/`](https://framework.niclaslindstedt.se/branch/)   | a parked feature branch       | a `pages` `workflow_dispatch` |

```bash
make dev-demo      # hot-reloading dev server against the framework source
make build-demo    # production build into site/
```

See [`demo/README.md`](demo/README.md) for how to add a per-component demo.
Deploy prerequisites: enable Pages with the **GitHub Actions** source, and point
a `framework` CNAME DNS record at `niclaslindstedt.github.io` (the custom domain
is set by [`demo/public/CNAME`](demo/public/CNAME)).

## Development

```bash
git clone https://github.com/niclaslindstedt/oss-framework.git
cd oss-framework
npm install
make test      # run the suite
make build     # bundle the library
make lint      # eslint + tsc --noEmit
```

### Finding what to extract next

The framework is filled by migrating shared code out of `notes` and
`checklist`. The `find-refactor-candidates` agent skill automates the survey:

```bash
# Requires MIRROR_BASE + MIRROR_TOKEN in the environment (GitLab mirror).
make clone-apps     # clone/refresh both apps into .reference/ (git-ignored)
make candidates     # rank shared files by cross-app similarity
```

See [`.agent/skills/find-refactor-candidates/SKILL.md`](.agent/skills/find-refactor-candidates/SKILL.md)
for the full playbook.

### Changelog & releases

The framework dogfoods its own `changelog` module: releases are driven by
**changeset fragments**, not hand-edited `CHANGELOG.md` entries. Every PR that
touches the published `src/` surface drops a one-line fragment under
[`.changes/unreleased/`](.changes/unreleased) (CI enforces this; see
[`.changes/README.md`](.changes/README.md)). The `release` workflow then derives
the semver bump from those fragments, collates them into a dated `CHANGELOG.md`
section, tags, publishes, and cuts a GitHub Release — no manual version
bookkeeping.

```bash
make bump        # print the bump the unreleased fragments imply
make changelog VERSION=X.Y.Z   # preview the collated section locally
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — architecture, conventions, and where new code goes.
- [`OSS_SPEC.md`](OSS_SPEC.md) — the project's governing OSS standard.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). This project follows
[`OSS_SPEC.md`](OSS_SPEC.md); not every section applies to a library (CLI,
man pages, and website-as-product requirements are out of scope).

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for noncommercial use.
