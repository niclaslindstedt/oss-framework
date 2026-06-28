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
[`src/app/`](./src/app) as a starting point. Everything visible is
assembled from the published modules — the `Sidebar` shell, the `/checklist`
tree, the `/components` primitives, the `/theme` appearance projection, the
`/storage` adapter, and the `/logging` buffer.

> **Adopting this as your own app?** The demo carries demo-only scaffolding
> (mock sync, source-build aliases, a "simulate update" dev toggle) you must
> replace or rename, not copy — though its PWA shell (manifest, icons, a real
> service worker driving `usePwaUpdate`) is genuine and lift-ready.
> [`ADOPTION.md`](./ADOPTION.md) is the seam manifest — every stand-in and
> what to do with it — and the [`adopt-app`](../.agent/skills/adopt-app/SKILL.md)
> skill runs the whole transform.

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
the theme module's CSS-variable contract — and the framework now **ships that
styling** (the token map, the flavour rules, the drawer keyframes, the preset
palettes), so the demo no longer hand-writes it. [`src/styles.css`](./src/styles.css)
is down to Tailwind v4 (via `@tailwindcss/vite`), an `@source` pointing at the
framework source so its classes are scanned, an `@import` of the framework's
[`framework.css`](../src/theme/framework.css), and the demo's own app-shell reset
(the full-viewport, non-scrolling layout — that part stays the app's).

Because the demo builds against framework **source** (not the published bundle),
it injects the per-preset `[data-theme="…"]` colour blocks at runtime with the
framework's `installPresetTokens()` (called in [`src/main.tsx`](./src/main.tsx)) —
generated from `PRESET_PALETTES`, so the preview can never drift from the data. A
**published** app does it in one line instead — `@import
"@niclaslindstedt/oss-framework/styles.css"` — which bundles the structural CSS
_and_ the baked-in preset palettes, with no runtime call.

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

### Installable PWA

The demo is a **real, installable PWA** — it dogfoods the framework's
[`pwa`](../src/pwa/README.md) module rather than faking it. The build plugin
[`pwa-plugin.ts`](./pwa-plugin.ts) emits a precaching service worker plus the
`version.json` and `precache-manifest.json` files `usePwaUpdate` reads, and
[`src/App.tsx`](./src/App.tsx) drives the `UpdateToast` from the hook. Deploy a
new build and an installed client surfaces the "a new version is ready" prompt
once the fresh worker reaches `waiting`; the Developer tab's "simulate update"
still stages the prompt on demand (it works in dev, where no worker registers).

Because all three slots share one origin, each gets its own service-worker
**scope** (`/`, `/preview/`, `/branch/`) and — via
[`cacheIdForBase`](./src/app/pwa.ts) — its own precache id (`oss-demo`,
`oss-demo-preview`, `oss-demo-branch`), so the slots never clobber each other's
caches. The `manifest.webmanifest` uses relative URLs (and a relative `id`), so
the one static file is correct at every base and each slot installs as a
distinct app.

The easy-to-miss part: the **release** worker's scope is `/`, which also covers
`/preview/` and `/branch/`. If you land on `/` first, its worker controls the
whole origin — so without a guard, a later navigation to `/preview/` would be
answered with the _release_ shell. Each worker therefore carries a **navigation
denylist** of the sibling slots nested under its scope (`DEPLOY_SLOTS` in
[`pwa-plugin.ts`](./pwa-plugin.ts)) and defers those navigations to the network,
letting each slot boot its own shell and register its own worker. The release
worker denies `/preview/` + `/branch/`; the nested slots need no denylist (their
scope already excludes the others).
