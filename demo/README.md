<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Demo — OSS Framework reference app

A small Vite + React app — **a real, working local-first checklist PWA** built
entirely from the framework's shared surface, in the apps' own black/green look.
Deployed to GitHub Pages by
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml). It builds
**against the framework's TypeScript source** (via the aliases in
[`vite.config.ts`](./vite.config.ts)), so every deploy reflects the exact commit
it was built from — not a published package.

It is the **reference app the framework is meant to seed**: a new app can lift
[`src/app/`](./src/app) wholesale as a starting point. Everything visible is
assembled from the published modules — the `Sidebar` shell, the `/checklist`
tree, the `/components` primitives, the `/theme` appearance projection, the
`/storage` adapter, and the `/logging` buffer.

What it implements:

- **The list screen** ([`src/app/ChecklistScreen.tsx`](./src/app/ChecklistScreen.tsx))
  — the active checklist with the framework's `Checklist`, the header progress
  ring (`ChecklistProgress`), copy / sync glyph buttons, and the create `Fab`
  with an inline composer.
- **The navigation** ([`src/app/SideMenuContent.tsx`](./src/app/SideMenuContent.tsx))
  — the namespace header, the checklist tree grouped into folders, the action
  grid, and the footer, framed by the framework `Sidebar` (docked on wide
  screens, a draggable drawer on phones).
- **A tabbed Settings dialog** ([`src/app/SettingsModal.tsx`](./src/app/SettingsModal.tsx))
  — composed from the `Modal` + `FloatingPanel` primitives, with General /
  Appearance / Editor / Storage / Developer / Logs tabs. Appearance embeds the
  theme module's `AppearancePicker` and previews live via `useApplyTheme`;
  Storage drives a real `StorageAdapter`; Logs renders the `/logging` buffer.
- **A document store** ([`src/app/useChecklistStore.ts`](./src/app/useChecklistStore.ts))
  — the "store stays in the app" seam: it owns the data, localStorage
  persistence, and an undo / redo history, while the framework owns the pure
  tree transforms it drives.

The shell that wires it together is [`src/App.tsx`](./src/App.tsx). When the
public surface grows, extend the reference app to use the new module rather than
adding a standalone showcase page.

### Styling

The framework components are styled with Tailwind utilities that resolve through
the theme module's CSS-variable contract. The demo wires that up in
[`src/styles.css`](./src/styles.css): Tailwind v4 (via `@tailwindcss/vite`), an
`@source` pointing at the framework source so its classes are scanned, and a
`@theme` block mapping each colour utility to a slot variable. The per-preset
slot _values_ are generated at runtime from the framework's `PRESET_PALETTES`
(see [`src/theme-tokens.ts`](./src/theme-tokens.ts)) so the preview can never
drift from the framework data — an app would normally hand-write those
`[data-theme="…"]` blocks in its own stylesheet.

## Run it locally

From the repo root (the demo is an npm workspace):

```bash
make dev-demo      # or: npm run dev:demo  — hot-reloading dev server
make build-demo    # or: npm run build:demo — production build into ../site/
```

## Deploy slots

`pages.yml` serves three slots at **[framework.niclaslindstedt.se](https://framework.niclaslindstedt.se)**
off one Pages site. Enabling it needs the repo's Pages source set to **GitHub
Actions**, a `framework` CNAME DNS record pointing at `niclaslindstedt.github.io`,
and the custom domain in [`public/CNAME`](./public/CNAME) (already committed —
only the artifact root carries it; the workflow strips it from the per-slot
copies):

| Path        | Content                       | Trigger                                        |
| ----------- | ----------------------------- | ---------------------------------------------- |
| `/`         | the latest release (`v*` tag) | a release (release.yml chains in), else `main` |
| `/preview/` | the current `main`            | every push to `main`                           |
| `/branch/`  | a parked feature branch       | `workflow_dispatch` with a `branch_ref` input  |

The slot's base path is injected as `VITE_BASE`, so the same build works at any
of the three. The `/branch/` build is persisted in the `branch-deploy` orphan
branch and rehydrated on every run, so it survives later deploys until the next
dispatch overwrites it.
