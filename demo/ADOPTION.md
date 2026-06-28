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
broken (a fake sync engine, fonts that never load).

## REWIRE — source build → installed package

| File                                                                                  | What it does                                                                                                                                                                        | Do this when adopting                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vite.config.ts`](./vite.config.ts) (framework alias)                                | Aliases every `@niclaslindstedt/oss-framework/*` subpath to `../src` so the demo builds from source.                                                                                | **Delete all the framework aliases.** Add `@niclaslindstedt/oss-framework` as a dependency (+ `.npmrc` pointing the scope at GitHub Packages with a `read:packages` token — see root README).                                                                                                                         |
| [`vite.config.ts`](./vite.config.ts) (`@fontsource/*`)                                | **Stubs** the optional font packages to an empty test stub — the demo never loads real webfonts.                                                                                    | **Remove the stub alias.** `npm install` the `@fontsource/*` families you actually offer (see the theme README's Fonts section), or drop the non-`mono` font options.                                                                                                                                                 |
| [`pwa-plugin.ts`](./pwa-plugin.ts) + [`vite.config.ts`](./vite.config.ts) (`demoPwa`) | Emits the demo's **real** service worker, `version.json`, and `precache-manifest.json`, and injects the install `<head>` tags. `workbox-window` is a real dependency now (no stub). | **KEEP it** — it is a real, minimal PWA build. Rename the cache-id prefix and swap the manifest/icons (see RENAME + the PWA section). To use `vite-plugin-pwa`/Workbox instead, replace `demoPwa` with it — the framework's `usePwaUpdate` drives any compliant SW that precaches under a `<cacheId>-precache` cache. |
| [`src/main.tsx`](./src/main.tsx) + [`src/styles.css`](./src/styles.css)               | Imports the framework's `framework.css` from source and calls `installPresetTokens()` at runtime.                                                                                   | A published app uses **one line** instead: `@import "@niclaslindstedt/oss-framework/styles.css"` (presets baked in) and drops the `installPresetTokens()` call. See the theme README Styling section.                                                                                                                 |
| [`vite.config.ts`](./vite.config.ts) (`outDir`)                                       | Builds into the repo-root `../site/` for the Pages deploy.                                                                                                                          | Point `outDir` at your own `dist/` (or just delete the override).                                                                                                                                                                                                                                                     |

## REPLACE — demo stand-ins for real infrastructure

| File / symbol                                                                                              | What it fakes                                                                                                                                                                                                          | Replace with                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/app/useMockSync.ts`](./src/app/useMockSync.ts)                                                       | A **simulated** sync engine — fakes a cloud round-trip, fault injection, offline. Feeds the framework `SyncStatus` glyph + `SyncDetailsModal`.                                                                         | A real sync engine over a `storage` backend (`createDropboxAdapter` / `createGoogleDriveAdapter` / folder / local). The framework paints the state; you own the state machine. For a local-only app, delete it and the sync UI. |
| [`src/App.tsx`](./src/App.tsx) "simulate update" staging (`simReady`, `simPending`, `onSimulateUpdate`)    | A demo-only toggle: the Developer tab stages a fake "waiting build" so the prompt is demoable without a real deploy. The **real** `usePwaUpdate()` hook is already wired alongside it (and drives a deployed install). | Keep the real `usePwaUpdate()` call. Delete the `simReady` / `simPending` flags and the `onSimulateUpdate` wiring — or keep them as a manual "force the prompt" test affordance.                                                |
| [`src/app/log.ts`](./src/app/log.ts) `seedLogsOnce()`                                                      | Pre-seeds the in-app log buffer with fake entries so the Logs tab looks alive on a fresh load.                                                                                                                         | Delete the call ([`App.tsx`](./src/App.tsx) `~L184`) and the function. Keep the `createLogStore` wiring — that's real.                                                                                                          |
| [`src/app/useChecklistStore.ts`](./src/app/useChecklistStore.ts) `simulateLegacyDoc()`                     | Drops a legacy on-disk document so the Settings → Developer button can demo a live migration.                                                                                                                          | Delete the method and its `onLoadLegacy` wiring. Keep `createMigrator` + your real migration chain ([`src/app/migrations.ts`](./src/app/migrations.ts)).                                                                        |
| [`src/app/settings/tabs.tsx`](./src/app/settings/tabs.tsx) storage-playground (`STORAGE_DOC_KEY`, `~L143`) | A toy `StorageAdapter` playground in the Developer tab.                                                                                                                                                                | Delete it (or replace with your real storage settings).                                                                                                                                                                         |
| [`src/app/useAchievements.ts`](./src/app/useAchievements.ts) retroactive backfill (`seeded`, `~L56–73`)    | One-time backfill so the demo's rich seed doesn't read as "everything already unlocked".                                                                                                                               | A green-field app starts empty, so delete the backfill. Keep the `record` / `unlocked` store — that's the real seam.                                                                                                            |
| [`src/app/seed.ts`](./src/app/seed.ts) `SEED`                                                              | The demo's sample checklist content (Swedish shopping/packing lists).                                                                                                                                                  | Your app's empty-state / onboarding document.                                                                                                                                                                                   |

## RENAME — demo identifiers

| Where                                                                          | Identifier                                                                                                                                          | Action                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Across `src/app/` (8 files)                                                    | `localStorage` keys prefixed **`oss-demo:checklist:`** / `oss-demo:` (doc, settings, namespaces, menu-position, logs, language, achievements, sync) | One find/replace of the `oss-demo:` prefix to your app's namespace, so two framework apps don't collide in the same origin. |
| [`package.json`](./package.json), [`index.html`](./index.html), `public/CNAME` | Demo name, title, custom domain                                                                                                                     | Your app's name / title; delete `public/CNAME` (it's the demo's Pages domain).                                              |
| [`src/app/pwa.ts`](./src/app/pwa.ts) `cacheIdForBase`                          | The **`oss-demo`** precache-cache-id prefix                                                                                                         | Rename to your app's slug so two framework apps don't share a precache on one origin.                                       |
| `public/manifest.webmanifest`, `public/icons/`                                 | The demo PWA's install name, description, and icons                                                                                                 | Your app's name / icons / theme color (see the PWA section below).                                                          |
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

## The PWA shell (the demo ships a real one)

The demo is an installable, self-updating PWA — it dogfoods the framework's
`pwa` module end to end across the three Pages slots (`/`, `/preview/`,
`/branch/`). What it ships, and what to make yours:

- `public/manifest.webmanifest` — name, description, theme color, `display:
standalone`. Uses **relative** URLs so one static file works at every slot
  base; rename it to your app.
- `public/icons/` — the install icons (192 / 512 / 512-maskable + an
  apple-touch icon and an `icon.svg` favicon). Replace with yours. The
  framework's `glyphDataUri` still re-badges the browser _tab_ at runtime; these
  are the _install_ icons a tab favicon can't supply.
- [`pwa-plugin.ts`](./pwa-plugin.ts) — a minimal build plugin that emits the
  service worker, `version.json`, and `precache-manifest.json` to the exact
  contract `usePwaUpdate` reads, and derives a per-slot precache id via
  [`src/app/pwa.ts`](./src/app/pwa.ts). Keep it, or swap in
  `vite-plugin-pwa`/Workbox — `usePwaUpdate` drives any compliant SW that
  precaches under a `<cacheId>-precache` cache.
