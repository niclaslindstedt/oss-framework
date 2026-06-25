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

| Export          | From              | Purpose                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------- |
| `useEscapeKey`  | `.` and `./hooks` | Capture-phase Escape handler gated on an `enabled` flag.         |
| `useApplyTheme` | `.` and `./theme` | Projects the chosen appearance onto `<html>` as CSS variables.   |
| theme data      | `.` and `./theme` | Preset vocabulary, per-preset palettes, `CustomTheme` + helpers. |

The `theme` module is the shared theme engine and theme data — the preset
vocabulary, the per-preset palettes, the Custom-theme shape, the webfont
loaders, and the projection that paints them onto `<html>`. The appearance
**store** stays in the consuming app. See
[`src/theme/README.md`](src/theme/README.md) for the full API and a
step-by-step guide to migrating an existing theme implementation onto it
(including how to reconcile a partial match).

```ts
import { useApplyTheme } from "@niclaslindstedt/oss-framework/theme";
```

Planned modules (seeded from the source apps): `storage` (the `StorageAdapter`
contract + local/folder/Dropbox/Drive backends) and `encryption` (at-rest
crypto plus the migration queue).

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

## Documentation

- [`AGENTS.md`](AGENTS.md) — architecture, conventions, and where new code goes.
- [`OSS_SPEC.md`](OSS_SPEC.md) — the project's governing OSS standard.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). This project follows
[`OSS_SPEC.md`](OSS_SPEC.md); not every section applies to a library (CLI,
man pages, and website-as-product requirements are out of scope).

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for noncommercial use.
