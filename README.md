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

| Export                   | From                   | Purpose                                                                              |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------ |
| `useEscapeKey`           | `.` and `./hooks`      | Capture-phase Escape handler gated on an `enabled` flag.                             |
| `useMediaQuery`          | `.` and `./hooks`      | Subscribe to a CSS media query; `useDesktopPointer` gates right-click affordances.   |
| `useRowSwipe`            | `.` and `./hooks`      | Swipe-to-reveal / swipe-to-dismiss gesture for a list row.                           |
| `usePullToRefresh`       | `.` and `./hooks`      | Touch pull-to-refresh gesture at a scroll region's top; fires an async `onRefresh`.  |
| `useUndoRedoShortcuts`   | `.` and `./hooks`      | Global Cmd/Ctrl+Z · Cmd/Ctrl+Shift+Z / Ctrl+Y bound to a document history.           |
| `useApplyTheme`          | `.` and `./theme`      | Projects the chosen appearance onto `<html>` as CSS variables.                       |
| theme data               | `.` and `./theme`      | Preset vocabulary, per-preset palettes, `CustomTheme` + helpers.                     |
| `SettingsModal`          | `.` and `./theme`      | Self-contained dialog over the appearance picker.                                    |
| `AppearancePicker`       | `.` and `./theme`      | Controlled theme / font / colour editor over a `ThemeAppearance`.                    |
| `ChangelogModal`         | `.` and `./changelog`  | "What's new" dialog over a Keep-a-Changelog `CHANGELOG.md`.                          |
| `parseChangelog`         | `.` and `./changelog`  | Parse a `CHANGELOG.md` into the typed release list it renders.                       |
| `StorageAdapter`         | `.` and `./storage`    | Byte-level persistence contract for swappable backends.                              |
| storage backends         | `.` and `./storage`    | Browser, local-folder, Dropbox, and Google Drive adapters.                           |
| `createLogStore`         | `.` and `./logging`    | In-app log ring buffer + capture mirror; the storage sink.                           |
| `LogViewer`              | `.` and `./logging`    | Live Logs panel over a store (filter, copy, clear); `useLogs` hook.                  |
| `Sidebar`                | `.` and `./sidebar`    | Responsive nav shell: docked sidebar / floating-button drawer.                       |
| `FloatingButton`         | `.` and `./sidebar`    | The draggable, edge-resting FAB the shell floats, reusable on its own.               |
| `Modal`                  | `.` and `./components` | Portalled accessible dialog (backdrop, focus trap, scroll lock).                     |
| `Button` / form          | `.` and `./components` | `Button`, `Checkbox`, `ClearableInput`, `SelectPicker`, `SegmentedControl`.          |
| `Badge` / `Fab`          | `.` and `./components` | A count pill and a floating action button.                                           |
| settings layout          | `.` and `./components` | `Section`, `Field`, `ToggleRow` — building blocks for a settings surface.            |
| `CipherGlyph`            | `.` and `./components` | An "encryptish" busy indicator — re-scrambling cipher glyphs, in place of a spinner. |
| `PullToRefreshIndicator` | `.` and `./components` | Slide-down pill that surfaces the `usePullToRefresh` gesture.                        |
| glyph set                | `.` and `./components` | Dependency-free inline SVG icons, each driven by `className`.                        |
| `Checklist`              | `.` and `./checklist`  | Nested checkable list — items, child checklists, cascade, progress, swipe-to-delete. |
| checklist tree           | `.` and `./checklist`  | Pure tree ops: `toggleNode`, `setAllChecked`, `removeNode`, `countProgress`, …       |
| glyph picker kit         | `.` and `./glyphs`     | Icon catalogue + `Glyph`, `GlyphPicker`, `ColorPalette`, and a favicon builder.      |
| `usePwaUpdate`           | `.` and `./pwa`        | Service-worker update lifecycle singleton: download progress + reload prompt state.  |
| `UpdateToast`            | `.` and `./pwa`        | Presentational "a new version is ready" prompt, driven by `usePwaUpdate`.            |
| `useStandaloneMobile`    | `.` and `./pwa`        | `true` inside an installed PWA on a phone — gate chrome-hiding affordances.          |

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
as the user picks. The appearance **store** stays in the consuming app. See
[`src/theme/README.md`](src/theme/README.md) for the full API and a
step-by-step guide to migrating an existing theme implementation onto it
(including how to reconcile a partial match).

```ts
import {
  SettingsModal,
  useApplyTheme,
} from "@niclaslindstedt/oss-framework/theme";
```

The `storage` module is the shared persistence layer: one `StorageAdapter` byte
contract and four backends — the browser's `localStorage`, a picked local
folder, Dropbox, and Google Drive — behind a single interface, with their OAuth,
offline-cache, and HTTP plumbing. Adapters move serialized text, not your data
model, so your serialize / migrate pipeline stays app-side. See
[`src/storage/README.md`](src/storage/README.md) for the full API and
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
composer) from the same primitive. See
[`src/sidebar/README.md`](src/sidebar/README.md) for the prop surface and the
small CSS-token / keyframe contract an app supplies.

```ts
import { Sidebar } from "@niclaslindstedt/oss-framework/sidebar";
```

The `components` module is the shared **UI primitives** — the consistent design
vocabulary an app builds its surfaces from. One implementation of the `Modal`
(portalled, accessible, scroll-locking, stacked-Escape), the `Button` (four
themed variants), the form controls (`Checkbox`, `ClearableInput`), the
`SelectPicker` dropdown (a keyboard-navigable `<select>` replacement on a
portalled `FloatingPanel`), and a dependency-free inline glyph set. Everything
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
and a per-row right-click handle via `onRowContextMenu` for desktop pointers);
`ChecklistProgress` is the header ring badge with a bulk check/uncheck menu; and
`tree.ts` is the pure, DOM-free core — `toggleNode` (cascades a check down the
whole subtree), `setAllChecked`, `removeNode`, `countProgress`,
`sortCheckedToBottom` — that an
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

Planned modules (seeded from the source apps): `encryption` (at-rest crypto plus
the migration queue).

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
