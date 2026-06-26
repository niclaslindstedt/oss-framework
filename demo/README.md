<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Demo — OSS Framework preview site

A small Vite + React app that showcases the framework's components, deployed to
GitHub Pages by [`.github/workflows/pages.yml`](../.github/workflows/pages.yml).
It builds **against the framework's TypeScript source** (via the aliases in
[`vite.config.ts`](./vite.config.ts)), so every deploy reflects the exact commit
it was built from — not a published package.

Today it showcases two modules:

- **theme** ([`src/demos/theme.tsx`](./src/demos/theme.tsx)) — renders the
  framework's `SettingsModal` / `AppearancePicker` and projects the chosen
  appearance onto `<html>` with `useApplyTheme`, so the whole page repaints live
  as you pick.
- **storage** ([`src/demos/storage.tsx`](./src/demos/storage.tsx)) — a live
  playground over the `StorageAdapter` contract: save / load / conflict against
  the browser backend (and a real local folder in Chromium), with copy-paste
  wiring snippets for the Dropbox and Google Drive backends.

As the public surface grows, add one demo per component: a file under
`src/demos/<component>.tsx` that imports the framework component it shows, e.g.

```tsx
import { ChangelogModal } from "@niclaslindstedt/oss-framework/changelog";
```

and render it from [`src/App.tsx`](./src/App.tsx).

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
