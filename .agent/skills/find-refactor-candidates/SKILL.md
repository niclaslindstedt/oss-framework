---
name: find-refactor-candidates
description: "Use when deciding what to extract into the OSS Framework next. Clones the sibling `budget` app, ranks its files by how little of each the framework already ships, and reports the highest-leverage net-new code to mine into a reusable component — flagging clusters that should move as a whole module."
---

# Find refactoring candidates

The OSS Framework holds reusable React components, hooks, and utilities for
building local-first PWAs. Its shared surface was mined from sibling local-first
PWAs and now ships under `src/<module>/` (each with a usage README). The next
**source material** is the sibling [`budget`](https://github.com/niclaslindstedt/budget)
app — a local-first PWA built on the same foundations — which carries surface the
framework does **not** ship yet. This skill finds the next best thing to mine out
of `budget` and turn into a framework component, ranked so the highest-leverage
extractions come first.

It does **not** perform the extraction. It produces the candidate list and the
evidence (how little the framework already covers a file, line counts,
whole-module clusters) a human or a follow-up agent uses to decide what to
extract, then how.

An extraction's home can be a **new** module _or_ an **existing** component,
hook, or module it enhances — integrating mined behaviour into a surface the
framework already ships is fully encouraged when it's the cleaner fit. See
["An extraction can enhance an existing component"](#an-extraction-can-enhance-an-existing-component--it-neednt-be-a-new-one)
under Extraction conventions.

> **Who consumes the framework — read this first.** The framework targets
> **new, green-field apps** built on top of it. `budget` is **source material,
> not a consumer**: its code is evidence of what's genuinely reusable, but it
> will **not** be migrated back onto the framework. There is no "remigrate into
> the donor app" step, and nothing about an extraction should be shaped by what
> `budget` happens to render today.
>
> The consequence for every decision: **optimise for the best possible
> component, not for drop-in compatibility with the donor.** Where `budget`'s
> version overlaps a module the framework already ships but is richer or has
> drifted, you are **not** forking a parallel copy — you **synthesise one best
> component**, grafting the stronger capability onto the cleaner contract and
> **inventing a better answer where neither is good.** Score every axis
> independently (contract cleanliness, capability completeness, naming, internal
> structure, defaults, accessibility) and take the strongest answer for each.
> **Refactor freely while you do it** — renaming, resplitting, reshaping, and
> inventing past the donor's shape during extraction is expected, not scope
> creep. Spend your effort on component quality (clean API, sensible defaults,
> good docs, demo polish), **not** on minimising migration friction for the app
> you sourced from.

## Where the framework stands today

The framework already ships the shared surface mined so far — skim `src/index.ts`
and the per-module `src/<module>/README.md` files to see exactly what's covered
before you propose a candidate. The similarity report (below) already measures
each `budget` file against that shipped surface, so you rarely need to enumerate
it by hand. The demo (`demo/`) is the reference app every extraction lands in;
read `demo/src/app/` to see its current scope and find the natural home for a new
surface.

## Tracking mechanism

A sibling [`.last-updated`](./.last-updated) file records the `budget` commit
hash the candidate list was last computed against, one per line:

```
budget <sha>
```

An empty file means "never run". Before reporting, re-clone the app (which
fetches its latest `main`) and compare the new hash against the recorded one — if
`budget` has moved, the previous candidate list is stale and must be recomputed.
Rewrite this file with the fresh hash at the end of a successful run.

## Discovery process

The app is not reachable from the agent sandbox over its public GitHub remote.
It is mirrored to GitLab and reached with a short-lived token supplied through
the environment — never hard-code or commit either value:

| Variable       | Example                       | Notes                          |
| -------------- | ----------------------------- | ------------------------------ |
| `MIRROR_BASE`  | `gitlab.com/niclaslindstedt/` | trailing slash                 |
| `MIRROR_TOKEN` | `glpat-…`                     | GitLab `read_repository` scope |

Run, from the framework repo root:

```bash
# 1. Clone or refresh the donor app into .reference/ (git-ignored). An empty
#    mirror clones cleanly and is left in place — there is nothing to mine
#    until it has content.
node .agent/skills/find-refactor-candidates/scripts/clone-apps.mjs

# 2. Record the baseline the report is computed against.
git -C .reference/budget rev-parse HEAD

# 3. Rank net-new candidates: how little of each donor file the framework
#    already ships. --max trims to the least-covered (most net-new) files;
#    --json emits the same data for a follow-up agent to consume.
node .agent/skills/find-refactor-candidates/scripts/similarity.mjs --max 50
node .agent/skills/find-refactor-candidates/scripts/similarity.mjs --json
```

`similarity.mjs` (also `npm run candidates`) keys every `.ts`/`.tsx` under
`budget`'s `src/` and scores each by its best line-multiset similarity to any
file under the framework's own `src/` — its **coverage**. Files the framework
already ships (same basename, or a near-duplicate at/above the coverage
threshold) are dropped as done. Output is two tables: a per-module rollup
(whole-cluster candidates) and a per-file ranking, **least-covered first** — the
clearest net-new surface. A donor app with no `src/` yet (an empty mirror) is
reported as such; there is nothing to mine until it is populated.

To inspect a specific candidate before proposing it, read the file and compare it
against its closest framework counterpart (the report names it) — coverage is
only a ranking heuristic:

```bash
sed -n '1,120p' .reference/budget/src/<path>
diff .reference/budget/src/<path> src/<closest-framework-file>   # when one is close
```

## Candidate → action mapping

Use the report to classify each candidate. This table is the skill's accumulated
judgment about how to treat each tier and shape; extend it as extractions teach
you more.

| Signal                                                                                                          | Interpretation                                                    | Action                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Low coverage** (< ~50%), self-contained (a hook, a glyph, an encoder)                                         | Net-new generic surface the framework lacks                       | Extract first. Lift the file, generalise names, add a test, wire the export.                                                                                                                                                                                                                                                                                                                                                                     |
| **Partial coverage** (~50–80%) — a framework module is close but the donor's is richer / has drifted            | The framework ships a thinner version                             | **Reconcile, don't fork.** Graft the donor's extra capability onto the existing module (widen it here, or file it for the `refactor` skill). Take the cleaner contract; add the richer capability. Never land a parallel copy.                                                                                                                                                                                                                   |
| **High coverage** (≥ ~80%, or same basename)                                                                    | Already shipped                                                   | Skip — done. The donor would adopt the framework's version.                                                                                                                                                                                                                                                                                                                                                                                      |
| A low-coverage **module** (whole `storage/`, `theme/`, … cluster)                                               | A subsystem the framework lacks wholesale                         | Plan a module-level migration; don't cherry-pick files that import each other.                                                                                                                                                                                                                                                                                                                                                                   |
| Any file > 1000 lines (⚠️ in the report)                                                                        | Violates OSS_SPEC §20.5                                           | Split by concern _as part of_ extraction — do not import the monolith.                                                                                                                                                                                                                                                                                                                                                                           |
| Domain nouns baked into types/names                                                                             | App-domain coupling                                               | Parameterise or generalise the type before it enters the public API.                                                                                                                                                                                                                                                                                                                                                                             |
| A **store** wrapping shared data (`useSyncExternalStore`, a synced settings doc, persistence keys)              | The data is shared; the store is app glue                         | **Leave the store in the app.** Extract the _data_ (types, presets, palettes) and the _pure logic_ it drives (projection, validation/coercion, seeding). The app keeps owning where the user's choice lives.                                                                                                                                                                                                                                     |
| Hand-maintained "remove every var/key" cleanup list parallel to a writer                                        | Drift bait — the two lists fall out of sync                       | When you extract the writer, make it **track what it wrote** (e.g. a `WeakMap` of written keys) and clear exactly that. One source of truth beats two parallel lists — a quality win worth taking _during_ the extraction.                                                                                                                                                                                                                       |
| Near-identical **repo tooling** (build/release scripts, CI workflows)                                           | Shared process, not shared library code                           | Copy it into the framework's own `scripts/` + workflows and **dogfood** it — don't ship it as an npm export (CLI scripts aren't importable surface). Generalise the app-specific bits (skip-lists, deploy env). A component whose data the tooling generates lands _with_ its tooling.                                                                                                                                                           |
| **App glue** wrapping an otherwise-shareable component (a `Modal`, `useT`/i18n, an icon set)                    | UI chrome fused to a portable core                                | **Drop the glue at the seam, don't parameterise it.** Replace the app `Modal` with a self-contained portal (reuse the framework's own primitives, e.g. `useEscapeKey`), i18n with injectable `labels` props (English defaults), and the icon import with inline glyphs. Keep build-tool inlining (`?raw` / `import.meta.glob`) the app's job — take the glob _result_, not the glob.                                                             |
| A **pure engine fused with a domain index** in one file (a matcher + `buildIndex`; a parser + an app-typed AST) | The generic half is verbatim; the whole-file score understates it | **Diff the halves, not the file.** The engine (text matcher, parser, projector) is often the clean shareable jewel while the index/result-type half is domain-shaped. Extract the engine under a **new name** (`search/matcher.ts`, not `domain/search.ts`), draw the seam at the **corpus** (the engine ranks/parses one input; `buildIndex` + result shapes + navigation stay app-side), and expose it as a compile-once / run-many primitive. |
| A **presentational component fused with `useT`** (a modal/panel whose only app coupling is the translator)      | i18n is glue, not a reason to skip                                | **`useT` coupling ≠ leave app-side.** A component whose only app dependency is `useT` (+ the app `Modal`/icons) is a clean lift: drop the glue at the seam (inject `labels`, swap to the framework's own `/components`). Distinguish this from a **translation table** that maps to specific `MessageKey`s — _that_ is app data and stays.                                                                                                       |

## Extraction conventions

When a run actually extracts a candidate (not just reports it), follow these.
They are the accumulated "how", learned from real migrations — keep them current
as the framework grows.

### Synthesise the best component — refactor during extraction (required)

The unit of extraction is **the best possible component for a new app**, not a
copy of the donor file. Refactoring _during_ extraction is the point, not a
detour:

- **Merge per axis, don't copy.** When the donor's file overlaps a module the
  framework already ships, score each on contract cleanliness, capability
  completeness, naming, internal structure, defaults, and accessibility. Take the
  best answer on each axis. The output is one synthesised component — frequently a
  capability superset, but _assembled_ from the best parts, never one copy lifted
  because it "had more".
- **Invent past the donor when its shape is weak.** If the donor's shape isn't
  good (a redundant flag, a parallel table that should be inlined, two cleanup
  lists that drift apart), design the better shape and land _that_ — even though
  the donor didn't use it. Extraction is a chance to fix the design, not freeze
  it.
- **Refactor freely at the seam.** Rename to neutral/general terms, split an
  over-1000-line monolith by concern (§20.5), de-duplicate helpers, hoist a shared
  shell, and invert container/presentational splits when props-driven is the
  cleaner seam. All expected _during_ extraction, not follow-up work.
- **Guardrail: synthesise the _component_, not the app.** Best-of-each applies to
  the shared, generic surface only. The store, domain types, and business rules
  still stay app-side — pulling more across the seam to "complete" the merge is
  the failure mode, not the goal.

### An extraction can enhance an existing component — it needn't be a new one

**The unit of extraction is the behaviour, not a new file.** When the best home
for the code you're mining is an **existing** framework component, hook, or
module, integrate it there — do **not** spin up a new component / hook / subpath
just because the donor app happened to keep it separate. A clean, logical
integration into a surface the framework already ships is a **first-class,
encouraged** outcome, often the _better_ result, because the adopter already
imports the thing.

Decide the home by where the behaviour belongs, not by how the donor filed it:

- **Enhance an existing component / hook** when the behaviour is a capability of
  something the framework already ships (a new optional prop, an extra exported
  helper, a default the component now owns). Make it **additive and overridable**
  so existing callers see no change — the absorbed behaviour defaults to today's
  output, the same backward-compatible bar the `refactor` skill's lifts hold to.
- **Add to an existing module (no new subpath)** when the code is a sibling of
  what a module already owns — extend its barrel and `src/index.ts` only; skip the
  `tsup.config.ts` / `package.json` `exports` wiring a brand-new subpath needs
  (the four-place checklist below — an in-module addition touches just the first
  two).
- **Create a new component / module** only when the behaviour is genuinely its own
  concern with no existing home.

The seam rules don't change: integrating into an existing surface is **not** a
licence to drag the store, domain types, or business rules across — hold the same
generic-only boundary. And when you enhance an existing component, the demo
integration (required, below) is to **deepen that component's existing seat** in
the demo, not bolt on a new screen.

### Every component ships a usage README (required)

**Every framework component/module must have a README** at
`src/<module>/README.md`. It is the deliverable that makes the extraction
_usable_ by the new apps that will build on it.

> **READMEs are app-agnostic — always.** The framework targets green-field apps,
> not the donor an extraction was sourced from. **Never name the donor app
> (`budget`, …) in a module README.** Write in terms of "your app" and the
> framework's own symbols. Source-app provenance belongs in this skill's notes,
> not in shipped docs. This rule holds for every README, present and future.

Write it as the module's own adoption guide for a **new app** building on the
framework. The audience is someone wiring this in from scratch, **not** someone
migrating a home-grown copy — so lead with how to use it well, not how to replace
something:

- **What it is / what it owns vs. what stays in the app** — be explicit about the
  seam (e.g. "the store stays in your app; the framework owns the data and the
  projection").
- **The contract** the module imposes (CSS variables written, DOM attributes,
  event shapes, file paths) so the app's other layers can line up.
- **Generic usage** — install, import, a quick-start wiring example, the full API
  surface. This is the heart of the README; make it excellent.
- **An "adapting to your app" section (required).** A new app's needs won't match
  the component exactly. Spell out the mismatches and how to reconcile each: the
  app wants **fewer** slots/fields than the component exposes (which controls to
  hide, what CSS to drop); the app needs **more** / **extra** surface the
  component lacks (layer it app-side, or propose widening the framework);
  **renamed** variables/keys (map them in CSS or an adapter); **different value
  mappings**; **store-shape** differences. Make the cases concrete so an adopter
  recognises theirs. Do **not** frame this as migrating off an existing
  implementation — frame it as fitting a clean component to a new app's
  requirements.
- **Verification** — how to confirm the app behaves correctly after wiring.

Link the module README from the top-level `README.md` API section and add a
`CHANGELOG.md` entry, per the `AGENTS.md` documentation sync points.

### Every extraction lands in the demo app (required)

**An extraction is not done until the new surface is wired into the demo app
(`demo/`) in a natural, realistic way that makes the demo experience _better_.** A
module that ships green tests but is invisible in the running app is only half
delivered — the demo is the framework's reference app and its living proof, and
every component must earn a place in it. Shipping dead exports the demo never
exercises is the failure mode this rule exists to prevent.

The bar is **realism, not a gallery.** Do not bolt on a "component showcase" page
or a contrived widget that only exists to render the new export. Find where the
new surface belongs in the app's actual flow and put it there, so a visitor meets
it the way a real user would:

1. **Obvious home first.** If the component has a natural seat in the existing UI,
   wire it there (a row gesture into the list rows; a glyph picker into a list's
   header; a `LogViewer` into a debug surface). This is always the preferred
   outcome.
2. **No obvious home? Widen the demo to create one — don't skip the integration.**
   Grow the app's scope until the component is the logical answer to a real need
   the larger app now has. Concretely, reach for:
   - **Extend Settings.** The tabbed Settings dialog is the natural host for most
     configuration-shaped surface (toggles, pickers, segmented controls,
     appearance/theme controls, an i18n language switch). Add a tab or a section.
   - **Add profiles / accounts / workspaces.** A multi-profile or multi-namespace
     model gives storage backends, sync, encryption, per-profile theme/appearance,
     and avatars a reason to exist — and is itself a realistic local-first PWA
     feature.
   - **Add the feature the component implies.** Encryption → a "lock this profile"
     flow + an unlock prompt. A storage backend → a "where your data lives" picker
     with a real connect/disconnect. Achievements → a profile stats surface. i18n →
     a language switch that actually re-renders. Widening the demo is **expected
     and encouraged**, not scope creep: the demo is meant to grow into a fuller
     local-first app as the framework's surface grows.
3. **Keep the seam honest.** The demo is an app, so it plays the app's role of the
   seam — it owns the store/state and passes data + labels into the framework
   component (English labels, the app's own persistence). Never reach past a
   module's public subpath export; if the demo needs something the export doesn't
   offer, that's a signal to widen the _module_, not to deep-import.
4. **Match the app's look and quality.** New demo UI must match the existing
   black/green look and the existing components' polish — it is reference code an
   adopter will copy. Wire real behaviour (undo, persistence, live updates), not
   stubs, wherever the surrounding screens already do.
5. **Verify it in the running app, not just in tests.** Build the demo
   (`npm run build --workspace demo`) and drive it (a headless Chromium screenshot
   of the new surface in use) before calling the extraction done — the demo must
   build green and the new surface must actually render and respond. A new subpath
   export also needs a `demo/vite.config.ts` alias (subpaths listed before the
   bare package so the specific match wins), or the demo build fails to resolve
   it.

When the demo gains a new screen, model, or settings area, record it in this
skill's notes so the next run builds on it instead of re-discovering it.

### Public-surface wiring checklist

A new subpath export (`./<module>`) touches four places — miss one and either the
import path 404s or the types don't ship:

- [ ] `src/<module>/index.ts` barrel re-exports the public surface.
- [ ] `src/index.ts` re-exports the module (for the root entry point).
- [ ] `tsup.config.ts` `entry` gains `"<module>/index": "src/<module>/index.ts"`.
- [ ] `package.json` `exports` gains the `./<module>` block (types/import/require).

### Practical gotchas seen so far

- **Side-effecting/asset imports** (e.g. `@fontsource/*` CSS the theme font
  loaders pull in) must stay the **consuming app's** dependency. Make them
  optional peer deps and: mark them `external` in `tsup.config.ts` (a regex like
  `/^@fontsource\//` keeps the dynamic `import()` specifier intact for the app's
  bundler), add an ambient `declare module "*.css";` so the framework's `tsc`
  passes without the packages installed, and alias them to an empty stub in
  `vitest.config.ts` so Vite's import analysis can resolve the file under test.
  Document the peer deps in the module README.
- **`import.meta` doesn't survive the CJS build** (esbuild can't emit it to CJS).
  Push bundler-specific bits (`import.meta.env`, `BASE_URL`) to the app as function
  args / config, the way the storage and pwa modules do.
- **`noUncheckedIndexedAccess` is on.** Index through typed `Record`s / known keys,
  not arbitrary lookups, or guard the `undefined`.
- **Run the gates after extracting** (`npm run lint && npm test && npm run build &&
npm run fmt:check`) so the new module lands green, and confirm the build
  **externalised** the asset imports (grep the dist for the specifier).

## Update checklist

When running this skill:

- [ ] `clone-apps.mjs` succeeded and `.reference/budget/src` exists (if the
      mirror is still empty, stop and report that there is nothing to mine yet).
- [ ] Recorded `budget`'s HEAD hash; compared against `.last-updated`.
- [ ] Generated the ranked candidate report (coverage vs the framework) and the
      per-module rollup.
- [ ] For each proposed candidate, read the real file — did not rely on the
      coverage score alone.
- [ ] Classified every proposed candidate via the mapping table above.
- [ ] Flagged any > 1000-line files for split-on-extraction.
- [ ] Produced a short, ordered "extract next" list (least-covered / highest-leverage first).
- [ ] Updated `.last-updated` with the fresh hash.
- [ ] Recorded any new structural insight back into this SKILL.md (see self-improvement).

If the run **also extracted** a candidate, additionally:

- [ ] Synthesised the best component — refactored / invented past the donor's shape (and any overlapping framework module) rather than lifting the donor copy wholesale.
- [ ] Left the app-specific store/state in the app; moved only the shared data + pure logic.
- [ ] Wrote the module's usage README (`src/<module>/README.md`) as an adoption guide for a new app (usage + "adapting to your app"), app-agnostic — never naming the donor.
- [ ] Wired the subpath export in all four places (barrel, root index, tsup, package.json) — or just the first two for an in-module addition.
- [ ] **Integrated the new surface into the demo app** in a natural, realistic way that improves the experience — wired into an existing flow, or the demo's scope widened (Settings tab, profiles, a new screen). No contrived showcase widgets.
- [ ] Added the matching `demo/vite.config.ts` alias for the new subpath, built the demo (`npm run build --workspace demo`) green, and **verified the new surface renders and responds in the running app** (headless screenshot).
- [ ] Updated top-level `README.md` API + a `.changes/unreleased/` fragment, and recorded any new demo screen / model / settings area in this skill's notes.
- [ ] Ran the gates green (`lint`, `test`, `build`, `fmt:check`) and confirmed asset imports stayed external in `dist/`.

## Notes — donor layout & demo scope

Kept current per the self-improvement rule. Skim before a run so coverage
surprises aren't re-discovered.

- **The coverage report's "closest framework file" column lies about overlap.**
  It names the nearest file by line-multiset, not a semantic twin — `SelectPicker`
  showed `App.tsx` as its closest while the framework _already ships_
  `components/SelectPicker.tsx`. Always confirm a candidate against the framework
  by **basename / module**, not the report's "closest" column.
- **Already shipped from budget (skip):** `components/FloatingPanel`,
  `components/SelectPicker`, `components/useFloatingPosition`, the theme
  `FontFamilyRow`/`FONT_FAMILIES` font picker, `search/*` highlighting
  (`segmentMatches` + `Highlighted`). budget's `i18n/locales/**` and `data/**`
  dominate the top of the report but are **app-domain data, not extractable** —
  filter them out (skip `i18n/`, `data/`, `seo/`) before ranking.
- **Type-ahead cluster (`hooks/useTypeahead`, `hooks/useRovingTabindex`,
  `utils/highlight`):** net-new in budget. **Extracted so far:** `useTypeahead`
  - `matchPrefixRange` (re-homed from `utils/highlight.ts`) into `src/hooks/`,
    and wired into `SelectPicker` (type-ahead is on by default when an option has a
    string label / `typeaheadLabel`). **Still unextracted (next candidates):**
    `useRovingTabindex` / `useGridRovingTabindex` — foundational WAI-ARIA roving
    tabindex hooks many menus/grids want; they need a real demo consumer (a
    keyboard-navigable menu or glyph grid) to land honestly.
- **Demo scope added this run:** the Storage tab's "Where your data lives" section
  now has a **Cloud drive `SelectPicker`** (shown only on the simulated-cloud
  backend), backed by `CLOUD_PROVIDERS` in `demo/src/app/useMockSync.ts`. The
  chosen provider's name flows into the header `SyncStatus` ("synced to …") and
  the `SyncDetailsModal` folder path. This is `SelectPicker`'s first demo seat —
  before this it was a shipped-but-unexercised export.

## Verification

Confirm the report is trustworthy before acting on it:

- Re-run `similarity.mjs` and spot-check two or three top-ranked (least-covered)
  files by reading them — a low coverage score should agree with "the framework
  has nothing like this". Where the report names a close framework counterpart,
  `diff` them and confirm the overlap is real.
- Confirm already-shipped files (same basename, or a near-duplicate at/above the
  coverage threshold) do **not** appear in the candidate list. If one you know is
  shipped shows up, the basename-dedup or the `COVERED_AT` threshold in
  `similarity.mjs` has drifted — or the framework module was extracted under a new
  name (a renamed twin keeps ranking; recognise it and skip it).
- If you actually extract a candidate in the same session, run the framework's own
  checks (`npm run lint && npm test`) so the new code lands green.

## Skill self-improvement

**Improve this skill at the end of every session.** The skill's value is its
accumulated judgment, not its scripts, and that judgment rots the same way the
duplication it hunts does. Every run must leave the skill **more relevant, less
stale, more precise, more accurate, more to the point, and more efficient than it
found it** — a session that taught you something and didn't fold it back was only
half-done. Treat this as a required step, not a nicety.

Each pass, in this spirit:

- **More relevant / less stale.** Update the **notes** the moment the donor's
  layout moves under you (a file split, a module renamed, a backend added) or the
  framework grows a module (so the next run's coverage baseline is understood).
  Delete notes that no longer hold. A note describing code that no longer exists
  is worse than no note.
- **More precise / accurate.** Add or refine rows in the **Candidate → action
  mapping** and **Extraction conventions** whenever reality diverged from what the
  skill predicted — a tier that behaved differently, a gotcha that bit you, a
  convergence call that needed user input. Encode the specific, checkable rule
  (the exact `tsup` flag, the exact file to touch), not a vague gesture.
- **More to the point.** If a section is longer than the judgment it carries,
  tighten it. Merge duplicated advice. Cut hedging. The skill is read under time
  pressure mid-task; every stale or padded line costs the next reader.
- **More efficient.** If the coverage heuristic mis-ranked something (scored a
  file as covered that a read showed is net-new, or vice versa), adjust the metric
  or the `COVERED_AT` threshold in `scripts/similarity.mjs` and note why. If a step
  in the discovery or extraction flow was wasted motion, remove or reorder it.

Commit the SKILL.md edits in the **same** change as the report or extraction the
run produced.
