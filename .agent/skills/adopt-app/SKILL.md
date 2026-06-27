---
name: adopt-app
description: "Use to bootstrap a NEW application from the OSS Framework — when a user wants to start an app on top of `@niclaslindstedt/oss-framework` by lifting the reference app (`demo/src/app/`) and turning it into their own. This is the consumer/adopter path, the mirror of the maintainer skills: it does not change the framework, it scaffolds a downstream app from it. Runs a deterministic transform — scaffold a Vite + React + Tailwind v4 project, install the package (with GitHub Packages auth), copy the demo's app skeleton, REWIRE source-aliases to the installed package, REPLACE the demo-only mocks (the simulated sync engine, the simulated PWA update, log/seed/migration demos), RENAME the `oss-demo:` identifiers, swap in the new domain, add the real PWA shell (manifest + service worker), then self-verify with a boot smoke test. Grounded in the demo's seam manifest (`demo/ADOPTION.md`): every mock and stub to replace is enumerated there, so adoption is a checklist, not a judgement call. Use when asked to 'start a new app with the framework', 'bootstrap from the demo', 'adopt oss-framework', 'scaffold an app from this'."
---

# Bootstrapping a new app from the framework

The framework is meant to be _seeded_: the reference app under
[`demo/src/`](../../../demo) is a complete, working local-first PWA built
entirely from the published surface, and a new app starts by lifting it and
mutating it into its own domain. This skill is the operating procedure for that
mutation.

It is the **adopter** counterpart to the maintainer skills
(`find-refactor-candidates`, `refactor`): those change the framework; this one
stands a downstream app **up from** it and never edits framework source. If you
find yourself wanting to change `src/`, you're in the wrong skill.

## The one ground truth: the seam manifest

[`demo/ADOPTION.md`](../../../demo/ADOPTION.md) enumerates **every** demo-only
seam — each mock, each source-build alias, each demo identifier — as a table
with a per-row action (REPLACE / REWIRE / RENAME / KEEP). The demo also carries
~70 inline `// in a real app …` comments, but those are prose for a human; the
manifest is the actionable list. **Read it first and treat it as your
checklist.** The biggest adoption failures are the silent ones it prevents:

- copying `vite.config.ts` wholesale, which **stubs out** `@fontsource/*` and
  `workbox-window` — fonts never load and the service-worker hook is a no-op,
  yet the build is green;
- shipping `useMockSync` — a fake sync engine — as if it were real;
- shipping the simulated PWA-update flow instead of `usePwaUpdate()`.

If the manifest and the demo have drifted (a seam moved, a new mock appeared),
**fix the manifest in the same change** — it's the contract the next adoption
relies on.

## Before you start — confirm the target

Adoption is destructive of assumptions, not files (you scaffold a fresh
project), but get these settled up front; they change the whole transform:

1. **Where does the new app live?** A new repo / directory outside this one.
   Never scaffold the consumer app _inside_ the framework repo.
2. **What's the domain?** The demo is a nested-checklist app. The KEEP rows are
   generic; the domain rows (`useChecklistStore`, `ChecklistScreen`, `types.ts`,
   `search.ts`, `achievements.ts`) get replaced wholesale. Know what replaces
   them before you start, or stub a minimal domain and iterate.
3. **Which modules does the app actually need?** The framework is 16 modules.
   Prune the ones the app won't use (e.g. no cloud sync → drop `sync` +
   `useMockSync`; no workspaces → drop `namespaces`). The README API table and
   each module README are the map. When unsure, keep it — it tree-shakes.
4. **Local-only or cloud-backed?** Decides whether `sync` / the cloud `storage`
   backends / `encryption` come along.

If any of these is unclear, ask before scaffolding — guessing the domain or the
module set means redoing the transform.

## The transform — step by step

Work top to bottom. Each step maps to a section of the seam manifest.

### 1. Scaffold a fresh project

A Vite + React 19 + TypeScript app with **Tailwind v4** (the framework's
components paint through Tailwind utilities — it is a hard prerequisite). Create
`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, an entry
`main.tsx`, and a Tailwind CSS entry. Do **not** copy the demo's
`vite.config.ts` — author a clean one (the demo's is full of source aliases and
stubs you don't want; see REWIRE).

### 2. Install the framework (REWIRE)

- Add `@niclaslindstedt/oss-framework` to `dependencies`, plus `react` /
  `react-dom` 19.
- Add an `.npmrc` pointing the scope at GitHub Packages with a `read:packages`
  token — the exact lines are in the root [`README.md`](../../../README.md)
  Install section. Without it the install 401s.
- Install the **real** optional peers the demo stubs: the `@fontsource/*`
  families you offer (or drop the non-`mono` fonts) and, for an installable PWA,
  `workbox-window`.
- In your `vite.config.ts`, add **no** framework aliases — resolve the package
  from `node_modules` like any dependency.

### 3. Wire the styling (REWIRE)

A published app needs **one import**, not the demo's source-build dance:

```css
/* app.css */
@import "tailwindcss";
@import "@niclaslindstedt/oss-framework/styles.css";
```

That bundle carries the token map, the flavour CSS, the drawer keyframes, and
every preset palette (baked from `PRESET_PALETTES`). **Drop** the demo's
`installPresetTokens()` call and its `@import` of `framework.css` from source —
those are only for building against source. Keep an app-shell reset of your own
(the demo's `styles.css` html/body block is a fine starting point — that part is
genuinely the app's). See the theme README's Styling section.

### 4. Copy the app skeleton (KEEP) and strip the demo-only seams (REPLACE)

Copy the KEEP files from the manifest (`App.tsx`, `useAppSettings`,
`useNamespaces`, `i18n/`, `SettingsModal` + `settings/`, and the domain files
you're about to replace). Then, **for each REPLACE row in the manifest**, delete
or swap the stand-in:

- `useMockSync` → a real sync engine over a `storage` backend, or delete it and
  the sync UI for a local-only app.
- the simulated PWA-update block in `App.tsx` → real `usePwaUpdate()`.
- `seedLogsOnce`, `simulateLegacyDoc`, the storage-playground, the achievements
  retroactive backfill, the `SEED` content → delete (keep the real wiring each
  sits next to: `createLogStore`, `createMigrator`, the `record`/`unlocked`
  store).

### 5. Swap in the domain

Replace the domain files (`useChecklistStore`, `ChecklistScreen`, `types.ts`,
`search.ts`, `achievements.ts`) with your app's model, screen, search corpus,
and achievement catalog — keeping the **same framework-component wiring** around
them. This is the "store stays in the app" seam working as designed: the
framework owns the mechanics and the UI; your store owns the data.

### 6. Rename identifiers (RENAME)

Find/replace the `oss-demo:` localStorage prefix to your app's namespace (so two
framework apps in one origin don't collide), and set the app name / title;
delete the demo's `public/CNAME`.

### 7. Add the real PWA shell

The static demo is **not installable** and omits this. Add a
`manifest.webmanifest`, a service worker (e.g. `vite-plugin-pwa` / Workbox)
wired to the real `usePwaUpdate()`, and install icons.

## Verify — close the loop

A green `tsc` is **not** sufficient: it passes happily with a stubbed service
worker and a fake sync engine still in place. Prove the app actually boots and
that no demo seam survived:

1. `npm run build` (and `tsc --noEmit`) clean.
2. **Boot smoke test.** Start the dev server and drive it with a headless
   Chromium script (Playwright is available — see the environment notes in
   [`AGENTS.md`](../../../AGENTS.md)). Assert:
   - the app renders (the shell + your main screen mount, no error overlay);
   - the theme resolved — `getComputedStyle(document.body).backgroundColor` is
     your themed value, not transparent/white default (proves `styles.css`
     loaded and `@source` emitted the utilities);
   - **no mock leaked** — e.g. the sync surface doesn't show the demo's
     simulated provider name; grep the bundle/DOM for `oss-demo:` and for the
     mock provider string and confirm they're gone.
3. **Manifest audit.** Walk every REPLACE / REWIRE row and confirm it's done —
   no `@fontsource`/`workbox-window` stub aliases, no `useMockSync` import, no
   `installPresetTokens` in a package-consuming app.

Report the smoke-test result (a screenshot is ideal). If a mock survived, the
adoption is not finished.

## What this skill does NOT do

- **Doesn't edit framework `src/`.** Adoption consumes the published surface. If
  the app needs something the surface doesn't offer, that's a
  `find-refactor-candidates` / `refactor` conversation in the framework repo —
  not a deep-import or a patch from the adopter side.
- **Doesn't scaffold inside this repo.** The consumer app is a separate project.
- **Doesn't ship demo scaffolding.** Every REPLACE row is a stand-in; leaving
  one in is the defining failure of a botched adoption.
- **Doesn't skip the smoke test.** "It type-checks" is not "it works."

## Skill self-improvement

If an adoption hit a seam the manifest didn't list (a new mock, a moved alias, a
fresh demo-only tab), **add the row to [`demo/ADOPTION.md`](../../../demo/ADOPTION.md)**
so the next adoption catches it — the manifest is only as good as the last run
kept it. If a whole step was missing here (a new prerequisite, a new PWA
requirement), add it to the transform above.
