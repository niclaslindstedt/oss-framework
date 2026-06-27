<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Adopting the demo as a new app — the seam manifest

This file is the machine-actionable companion to the
[`adopt-app`](../.agent/skills/adopt-app/SKILL.md) skill. The demo under
[`src/`](./src) is a **real, working local-first PWA built entirely from the
framework** — it is the template a new app lifts. But it is also a _demo_, so it
carries scaffolding that exists only to showcase the framework in a static
GitHub Pages deploy with no real backend. **Copying the demo verbatim ships that
scaffolding into your app.**

Every seam below is one of:

- **REPLACE** — demo-only stand-in (a mock, a simulation). Swap it for the real
  thing or your app is fake.
- **REWIRE** — build-time plumbing that points at framework _source_; a
  published app points at the installed _package_ instead.
- **RENAME** — a demo identifier (storage key, app name) you must make yours.
- **KEEP** — genuinely reusable app skeleton; lift it as-is and edit the domain.

Work the REPLACE and REWIRE rows or the app will build green while quietly
broken (a stubbed service worker, a fake sync engine, fonts that never load).

## REWIRE — source build → installed package

| File                                                                    | What it does                                                                                         | Do this when adopting                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vite.config.ts`](./vite.config.ts) (framework alias)                  | Aliases every `@niclaslindstedt/oss-framework/*` subpath to `../src` so the demo builds from source. | **Delete all the framework aliases.** Add `@niclaslindstedt/oss-framework` as a dependency (+ `.npmrc` pointing the scope at GitHub Packages with a `read:packages` token — see root README).         |
| [`vite.config.ts`](./vite.config.ts) (`@fontsource/*`)                  | **Stubs** the optional font packages to an empty test stub — the demo never loads real webfonts.     | **Remove the stub alias.** `npm install` the `@fontsource/*` families you actually offer (see the theme README's Fonts section), or drop the non-`mono` font options.                                 |
| [`vite.config.ts`](./vite.config.ts) (`workbox-window`)                 | **Stubs** the PWA peer dep — the demo registers no service worker.                                   | **Remove the stub alias.** `npm install workbox-window` and register a real service worker (see the PWA row below).                                                                                   |
| [`src/main.tsx`](./src/main.tsx) + [`src/styles.css`](./src/styles.css) | Imports the framework's `framework.css` from source and calls `installPresetTokens()` at runtime.    | A published app uses **one line** instead: `@import "@niclaslindstedt/oss-framework/styles.css"` (presets baked in) and drops the `installPresetTokens()` call. See the theme README Styling section. |
| [`vite.config.ts`](./vite.config.ts) (`outDir`)                         | Builds into the repo-root `../site/` for the Pages deploy.                                           | Point `outDir` at your own `dist/` (or just delete the override).                                                                                                                                     |

## REPLACE — demo stand-ins for real infrastructure

| File / symbol                                                                                                  | What it fakes                                                                                                                                  | Replace with                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/app/useMockSync.ts`](./src/app/useMockSync.ts)                                                           | A **simulated** sync engine — fakes a cloud round-trip, fault injection, offline. Feeds the framework `SyncStatus` glyph + `SyncDetailsModal`. | A real sync engine over a `storage` backend (`createDropboxAdapter` / `createGoogleDriveAdapter` / folder / local). The framework paints the state; you own the state machine. For a local-only app, delete it and the sync UI. |
| [`src/App.tsx`](./src/App.tsx) PWA-update block (`updateReady`, `pendingBuild`, `checkForUpdate`, `~L133–149`) | A **simulated** service-worker update lifecycle (the Developer tab stages a "waiting build").                                                  | The real `usePwaUpdate()` hook from `@niclaslindstedt/oss-framework/pwa`, driven by your registered service worker.                                                                                                             |
| [`src/app/log.ts`](./src/app/log.ts) `seedLogsOnce()`                                                          | Pre-seeds the in-app log buffer with fake entries so the Logs tab looks alive on a fresh load.                                                 | Delete the call ([`App.tsx`](./src/App.tsx) `~L184`) and the function. Keep the `createLogStore` wiring — that's real.                                                                                                          |
| [`src/app/useChecklistStore.ts`](./src/app/useChecklistStore.ts) `simulateLegacyDoc()`                         | Drops a legacy on-disk document so the Settings → Developer button can demo a live migration.                                                  | Delete the method and its `onLoadLegacy` wiring. Keep `createMigrator` + your real migration chain ([`src/app/migrations.ts`](./src/app/migrations.ts)).                                                                        |
| [`src/app/settings/tabs.tsx`](./src/app/settings/tabs.tsx) storage-playground (`STORAGE_DOC_KEY`, `~L143`)     | A toy `StorageAdapter` playground in the Developer tab.                                                                                        | Delete it (or replace with your real storage settings).                                                                                                                                                                         |
| [`src/app/useAchievements.ts`](./src/app/useAchievements.ts) retroactive backfill (`seeded`, `~L56–73`)        | One-time backfill so the demo's rich seed doesn't read as "everything already unlocked".                                                       | A green-field app starts empty, so delete the backfill. Keep the `record` / `unlocked` store — that's the real seam.                                                                                                            |
| [`src/app/seed.ts`](./src/app/seed.ts) `SEED`                                                                  | The demo's sample checklist content (Swedish shopping/packing lists).                                                                          | Your app's empty-state / onboarding document.                                                                                                                                                                                   |

## RENAME — demo identifiers

| Where                                                                          | Identifier                                                                                                                                          | Action                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Across `src/app/` (8 files)                                                    | `localStorage` keys prefixed **`oss-demo:checklist:`** / `oss-demo:` (doc, settings, namespaces, menu-position, logs, language, achievements, sync) | One find/replace of the `oss-demo:` prefix to your app's namespace, so two framework apps don't collide in the same origin. |
| [`package.json`](./package.json), [`index.html`](./index.html), `public/CNAME` | Demo name, title, custom domain                                                                                                                     | Your app's name / title; delete `public/CNAME` (it's the demo's Pages domain).                                              |
| [`src/app/look.ts`](./src/app/look.ts) `APP_LOOK`                              | The black/green default appearance                                                                                                                  | KEEP to inherit the shared look, or seed your own `ThemeAppearance`. The user can re-theme either way.                      |

## KEEP — the reusable app skeleton (lift, then edit the domain)

These are the parts the framework is meant to seed — generic wiring you keep and
point at your own domain:

- [`src/App.tsx`](./src/App.tsx) — the shell that composes `Sidebar` + main +
  the modals + `useApplyTheme`. The wiring pattern is the template; strip the
  REPLACE blocks above.
- [`src/app/useAppSettings.ts`](./src/app/useAppSettings.ts) — the
  localStorage-backed app-settings store (the non-theme slice). Generic pattern;
  swap the `AppSettings` fields for yours.
- [`src/app/useNamespaces.ts`](./src/app/useNamespaces.ts) — the namespaces
  registry + active-pointer store over the framework's pure ops. Generic.
- [`src/app/i18n/`](./src/app/i18n) — the `createI18n` wiring + `LanguageRoot`.
  Keep the machinery; replace the `en` / `sv` string tables with yours.
- [`src/app/SettingsModal.tsx`](./src/app/SettingsModal.tsx) +
  [`settings/`](./src/app/settings) — the tabbed settings dialog. Keep the
  General / Appearance / Logs tabs; the Editor / Developer tabs are
  checklist-flavoured — adapt or drop.
- [`src/app/useChecklistStore.ts`](./src/app/useChecklistStore.ts),
  [`ChecklistScreen.tsx`](./src/app/ChecklistScreen.tsx),
  [`types.ts`](./src/app/types.ts), [`search.ts`](./src/app/search.ts),
  [`achievements.ts`](./src/app/achievements.ts) — **the domain**. This is where
  your app diverges most: replace the checklist document model, screen, search
  corpus, and achievement catalog with your own, keeping the same
  framework-component wiring around them.

## Add for a real PWA (the demo omits these)

The static demo is not installable. A real PWA also needs, and the demo does
**not** ship:

- a `manifest.webmanifest` (name, icons, theme color, `display: standalone`);
- a service worker (e.g. via `vite-plugin-pwa` / Workbox) — then drive the
  update prompt with the framework's real `usePwaUpdate()` (see the REPLACE row);
- app icons / the favicon pipeline (the framework's `glyphDataUri` re-badges the
  tab, but you still supply install icons).
