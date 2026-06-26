---
name: find-refactor-candidates
description: "Use when deciding what to extract into the OSS Framework next. Clones the notes and checklist apps, ranks files by cross-app similarity, and reports the cheapest, safest shared code to migrate — flagging clusters that should move as a whole module."
---

# Find refactoring candidates

The OSS Framework exists to hold the functionality that `notes` and
`checklist` currently maintain as near-duplicate copies — storage backends,
encryption, themes, folders, namespaces, achievements, i18n, swipe/gesture
hooks, modals. This skill finds the next best thing to pull out of those two
apps and into the framework, ranked so the safest, highest-leverage
extractions come first.

It does **not** perform the extraction. It produces the candidate list and
the evidence (similarity, line counts, whole-module clusters) a human or a
follow-up agent uses to decide what to migrate, then how.

## Tracking mechanism

A sibling [`.last-updated`](./.last-updated) file records the two app commit
hashes the candidate list was last computed against, one per line:

```
notes <sha>
checklist <sha>
```

An empty file means "never run". Before reporting, re-clone the apps (which
fetches their latest `main`) and compare the new hashes against the recorded
ones — if either app has moved, the previous candidate list is stale and must
be recomputed. Rewrite this file with the fresh hashes at the end of a
successful run.

## Discovery process

The apps are not reachable from the agent sandbox over their public GitHub
remotes. They are mirrored to GitLab and reached with a short-lived token
supplied through the environment — never hard-code or commit either value:

| Variable       | Example                       | Notes                          |
| -------------- | ----------------------------- | ------------------------------ |
| `MIRROR_BASE`  | `gitlab.com/niclaslindstedt/` | trailing slash                 |
| `MIRROR_TOKEN` | `glpat-…`                     | GitLab `read_repository` scope |

Run, from the framework repo root:

```bash
# 1. Clone or refresh the source apps into .reference/ (git-ignored).
node .agent/skills/find-refactor-candidates/scripts/clone-apps.mjs

# 2. Record the baseline the report is computed against.
git -C .reference/notes      rev-parse HEAD
git -C .reference/checklist  rev-parse HEAD

# 3. Rank shared files by similarity. --min trims the long tail;
#    --json emits the same data for a follow-up agent to consume.
node .agent/skills/find-refactor-candidates/scripts/similarity.mjs --min 80
node .agent/skills/find-refactor-candidates/scripts/similarity.mjs --json
```

`similarity.mjs` (also `npm run candidates`) keys every `.ts`/`.tsx` under each app's `src/` by
its src-relative path, keeps the paths present in _every_ app, and scores each
by line-multiset similarity. Files whose basename already exists under the
framework's `src/` are dropped as already-migrated. Output is two tables: a
per-module rollup (whole-cluster candidates) and a per-file ranking.

To inspect a specific candidate before proposing it, read the real diff —
similarity is only a ranking heuristic:

```bash
diff .reference/notes/src/<path> .reference/checklist/src/<path>
```

## Candidate → action mapping

Use the report to classify each candidate. This table is the skill's
accumulated judgment about how to treat each tier and module; extend it as
extractions teach you more.

| Signal                                                                                                              | Interpretation                              | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 95% similar, self-contained (a hook, a glyph, an encoder)                                                         | Shared verbatim, trivial deps               | Extract first. Lift the file, generalize names, add a test, re-export.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 80–95% similar                                                                                                      | Shared logic with app-specific drift        | Extract the common core; thread the differences through props / params / a small config object.                                                                                                                                                                                                                                                                                                                                                                                                 |
| High-similarity **module** (whole `storage/`, `theme/`, `achievements/` cluster)                                    | A subsystem duplicated wholesale            | Plan a module-level migration; don't cherry-pick files that import each other.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| < 80% similar                                                                                                       | Genuinely diverged or app-specific          | Leave in the apps for now; revisit after the cheap wins land.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Any file > 1000 lines (⚠️ in the report)                                                                            | Violates OSS_SPEC §20.5                     | Split by concern _as part of_ extraction — do not import the monolith.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Names baked in (`Note`, `checklist`)                                                                                | App-domain coupling                         | Parameterize or generalize the type before it enters the public API.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Copies that were _supposed_ to be identical but **drifted** (different slot counts, extra fields, renamed CSS vars) | Accidental divergence, not design           | **Converge, don't preserve.** Pick the **superset** as canonical and migrate both apps onto it — never drop a field/slot an app actively renders (its CSS reads it, its UI shows it). Do **not** parameterize the engine just to keep both drifted shapes alive; that ossifies the drift instead of healing it. Confirm the direction by checking which copy is the ancestor / actively uses the extra surface. Ask the user if the convergence has real UX cost (e.g. one app gains controls). |
| A **store** wrapping shared data (`useSyncExternalStore`, a synced settings doc, persistence keys)                  | The data is shared; the store is app glue   | **Leave the store in the app.** Extract the _data_ (types, presets, palettes) and the _pure logic_ it drives (projection, validation/coercion, seeding). The store is usually fused with app-only concerns (achievements, editor prefs, list layout) and must not come along. The app keeps owning where the user's choice lives.                                                                                                                                                               |
| Hand-maintained "remove every var/key" cleanup list parallel to a writer                                            | Drift bait — the two lists fall out of sync | When you extract the writer, make it **track what it wrote** (e.g. a `WeakMap` of written keys) and clear exactly that. One source of truth beats two parallel lists — a quality win worth taking _during_ the extraction.                                                                                                                                                                                                                                                                      |
| Near-identical **repo tooling** (build/release scripts, CI workflows) duplicated across apps                        | Shared process, not shared library code     | Copy it into the framework's own `scripts/` + workflows and **dogfood** it — don't ship it as an npm export (CLI scripts aren't importable surface). Generalise the app-specific bits (skip-lists, doc-slug examples, deploy env). A component whose data this tooling generates (e.g. `changelog` ← changeset fragments) should land _with_ its tooling so the framework uses the same pipeline it ships.                                                                                      |
| **App glue** wrapping an otherwise-shareable component (a `Modal`, `useT`/i18n, an icon set)                        | UI chrome fused to a portable core          | **Drop the glue at the seam, don't parameterise it.** Replace the app `Modal` with a self-contained portal (reuse the framework's own primitives, e.g. `useEscapeKey`), i18n with injectable `labels` props (English defaults), and the icon import with inline glyphs. Keep build-tool inlining (`?raw` / `import.meta.glob`) the app's job — take the glob _result_, not the glob.                                                                                                            |

Known structural notes about the source apps (keep current):

- **`storage/` (transport layer) — extracted (done).** Lives in the framework
  as `@niclaslindstedt/oss-framework/storage`: the `StorageAdapter` byte
  contract + typed errors, the `FileStore` seam, the four backends
  (`browser`/`folder`/`dropbox`/`gdrive`), their OAuth (PKCE + GIS),
  `http-utils`, the `withLocalCache` offline mirror, and a generic single-file
  binding (`createFileStoreAdapter`). The two apps had **diverged**: checklist's
  `adapter.ts` is clean bytes, notes' was fused with `Note` / attachments /
  encryption — the framework took **checklist's clean contract** as canonical.
  The line was drawn at the **transport** (the `FileStore`-level backends, which
  were near-identical across apps), **not** the binding: each app's
  `directory-adapter.ts` (the multi-file markdown codec — domain-coupled to
  `domain/types`, `serialize`, `crypto`, the folder registry, phantom-conflict)
  **stays app-side** and just rewires its `FileStore` import to the framework.
  App glue was dropped at the seam: the in-app logger became an injectable
  `Logger` (default no-op), env-var config (`VITE_DROPBOX_APP_KEY`,
  `VITE_GOOGLE_CLIENT_ID`) became function args, and namespace coupling became
  an explicit `rootPath`/`subdirectory`/`key`. **Encryption did not come** —
  it's a separate byte-boundary wrapper (`src/encryption/`). See
  `src/storage/README.md`.
- The migration for each app: delete its `dropbox`/`gdrive`/`folder` FileStores,
  `oauth-pkce`, `http-utils`, `cache`, `base64url` (the duplicated bulk) and
  import them from the framework; keep its own `directory-adapter.ts` and point
  its `FileStore` import at the framework. notes keeps its extra optional adapter
  methods (`fetchAttachment`, `migrateNote`, …) by intersecting the framework's
  base `StorageAdapter` type locally.
- **`theme/` — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/theme` (`presets`, `palettes`,
  `custom-theme`, `fonts`, `engine`). The two apps had **drifted**: notes
  carried 11 colour slots + a single `--radius` + `--density-row-py`;
  checklist carried 18 slots + `--radius-sm/md/lg` + `--density-row-px` +
  `--border-width`. They were _meant_ to be identical, so the framework
  converged both onto checklist's superset (notes converges up — it cannot
  drop slots checklist renders). **The appearance store stayed in each app**
  (notes fuses it with the synced achievements map + editor settings); only
  the data + projection + font loaders + `coerceCustomTheme` moved. notes'
  migration includes a real CSS change (new slots, radius triple,
  border-width); checklist's is nearly drop-in. See `src/theme/README.md`.
- **`ui/changelog/` — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/changelog` (`ChangelogModal`,
  `parseChangelog`, `parseFeatureDoc` / `buildFeatureDocs`, the markdown
  renderer). The two apps had drifted only cosmetically (comments, and the
  per-kind colour map — notes folded kinds onto fewer slots, checklist used the
  full positive/success/negative set); the framework took **checklist's
  superset** mapping (it matches the converged 18-slot theme) and made the
  strings/colours injectable (`labels` / `typeColors`) so neither app's UX is
  lost. **App glue was dropped at the seam, not parameterised:** the `Modal`,
  `useT` (i18n), and icon imports were replaced by a self-contained portal modal
  (reusing the framework's own `useEscapeKey`), `labels` props, and inline
  glyphs; the `import.meta.glob`/`?raw` _inlining_ stays the app's job
  (`buildFeatureDocs` takes the glob result). notes' `domain/markdown.ts` came
  along as an internal `markdown.ts` (parser only — `shortenUrl` left behind).
  The **release tooling** that feeds it (`scripts/release/*.mjs`: changeset
  fragments → `collate-changelog` + `compute-bump` + `extract-section`, gated by
  `check-changeset`) was near-identical across the apps and was copied in and
  **dogfooded** for the framework's own releases. See `src/changelog/README.md`
  and `.changes/README.md`.
- `theme/themes.ts` in each app also holds **non-theme** settings (notes:
  `EditorSettings`, `ListLayout`, `FolderPlacement`; both: misc prefs). Those
  are app-specific — do not pull them into the framework's `theme` module.
- `storage/useStorageBackend.ts` is the largest shared file (~2000 lines) and
  blows the §20.5 limit — it must be decomposed during extraction, not lifted.
- `i18n/locales/**` similarity is low by design (translations differ); the
  i18n _machinery_ (`i18n/index.ts`, `locale.ts`) is the real candidate.

## Extraction conventions

When a run actually extracts a candidate (not just reports it), follow these.
They are the accumulated "how", learned from real migrations — keep them
current as the framework grows.

### Every component ships a migration README (required)

**Every framework component/module must have a migration README** at
`src/<module>/README.md`. It is the deliverable that makes the extraction
_usable_.

> **READMEs are app-agnostic — always.** The framework is consumed by many apps,
> not just the ones an extraction happened to be sourced from. **Never name a
> specific consuming app (`notes`, `checklist`, …) in a module README.** Write
> in terms of "your app" and the framework's own symbols. App-specific migration
> notes belong in the skill's structural notes (here), not in shipped docs. This
> rule holds for every README, present and future.

Write it as the module's own import guide for any app replacing a comparable
home-grown implementation:

- **What it is / what it owns vs. what stays in the app** — be explicit about
  the seam (e.g. "the store stays in your app; the framework owns the data and
  the projection").
- **The contract** the module imposes (CSS variables written, DOM attributes,
  event shapes, file paths) so the app's other layers can line up.
- **Generic usage** — install, import, a quick-start wiring example, the full
  API surface.
- **A migration section, framed by degree of match.** Describe how to move a
  pre-existing implementation onto the framework in general terms (what
  shrinks, what gets deleted, what becomes a thin adapter; show before/after
  with framework symbols, not app filenames).
- **A "partial match" section (required).** Most adopters will _not_ match the
  framework exactly. Spell out the mismatches that arise and how to reconcile
  each: the app has **fewer** slots/fields than the framework (extra controls
  appear with nothing to style → add the CSS, or hide the control); the app has
  **more** / **extra** surface the framework lacks (keep it app-side layered on
  top, or propose widening the framework); **renamed** variables/keys (map them
  in CSS or an adapter); **different value mappings** (the framework's concrete
  values differ from the app's); **store-shape** differences. Make the failure
  modes concrete so an adopter recognises their case.
- **Verification** — how to confirm the app still behaves after wiring.

Link the module README from the top-level `README.md` API section and add a
`CHANGELOG.md` entry, per the `AGENTS.md` documentation sync points.

### Public-surface wiring checklist

A new subpath export (`./<module>`) touches four places — miss one and either
the import path 404s or the types don't ship:

- [ ] `src/<module>/index.ts` barrel re-exports the public surface.
- [ ] `src/index.ts` re-exports the module (for the root entry point).
- [ ] `tsup.config.ts` `entry` gains `"<module>/index": "src/<module>/index.ts"`.
- [ ] `package.json` `exports` gains the `./<module>` block (types/import/require).

### Practical gotchas seen so far

- **Side-effecting/asset imports** (e.g. `@fontsource/*` CSS the theme font
  loaders pull in) must stay the **consuming app's** dependency. Make them
  optional peer deps and: mark them `external` in `tsup.config.ts` (a regex
  like `/^@fontsource\//` keeps the dynamic `import()` specifier intact for the
  app's bundler), add an ambient `declare module "*.css";` so the framework's
  `tsc` passes without the packages installed, and alias them to an empty stub
  in `vitest.config.ts` so Vite's import analysis can resolve the file under
  test. Document the peer deps in the module README.
- **`noUncheckedIndexedAccess` is on.** Index through typed `Record`s / known
  keys, not arbitrary lookups, or guard the `undefined`.
- **Run the gates after extracting** (`npm run lint && npm test && npm run
build && npm run fmt:check`) so the new module lands green, and confirm the
  build **externalised** the asset imports (grep the dist for the specifier).

## Update checklist

When running this skill:

- [ ] `clone-apps.mjs` succeeded and `.reference/notes` + `.reference/checklist` exist.
- [ ] Recorded both app HEAD hashes; compared against `.last-updated`.
- [ ] Generated the ranked report (`--min 80`) and the per-module rollup.
- [ ] For each proposed candidate, read the real `diff` — did not rely on the score alone.
- [ ] Classified every proposed candidate via the mapping table above.
- [ ] Flagged any > 1000-line files for split-on-extraction.
- [ ] Produced a short, ordered "extract next" list (cheapest / highest-leverage first).
- [ ] Updated `.last-updated` with the fresh hashes.
- [ ] Recorded any new structural insight back into this SKILL.md (see self-improvement).

If the run **also extracted** a candidate, additionally:

- [ ] Decided the convergence direction for any drifted copies (superset wins; nothing an app renders is dropped).
- [ ] Left the app-specific store/state in the apps; moved only the shared data + pure logic.
- [ ] Wrote the module's migration README (`src/<module>/README.md`) with a per-app replacement guide.
- [ ] Wired the subpath export in all four places (barrel, root index, tsup, package.json).
- [ ] Updated top-level `README.md` API + `CHANGELOG.md`.
- [ ] Ran the gates green (`lint`, `test`, `build`, `fmt:check`) and confirmed asset imports stayed external in `dist/`.

## Verification

Confirm the report is trustworthy before acting on it:

- Re-run `similarity.mjs` and spot-check two or three top-ranked files with a
  real `diff` — the score and the diff should agree.
- Confirm already-migrated files (e.g. `useEscapeKey`) do **not** appear in
  the candidate list; if one does, the basename-dedup in `similarity.mjs` or
  the framework `src/` layout has drifted.
- If you actually extract a candidate in the same session, run the framework's
  own checks (`npm run lint && npm test`) so the new code lands green.

## Skill self-improvement

**Improve this skill at the end of every session.** The skill's value is its
accumulated judgment, not its scripts, and that judgment rots the same way the
duplication it hunts does. Every run must leave the skill **more relevant, less
stale, more precise, more accurate, more to the point, and more efficient than
it found it** — a session that taught you something and didn't fold it back was
only half-done. Treat this as a required step, not a nicety.

Each pass, in this spirit:

- **More relevant / less stale.** Update the **structural notes** the moment the
  apps' layout moves under you (a file split, a module renamed, a backend added,
  a module extracted → mark it _done_ and point at its README). Delete notes
  that no longer hold. A structural note that describes code that no longer
  exists is worse than no note.
- **More precise / accurate.** Add or refine rows in the **Candidate → action
  mapping** and **Extraction conventions** whenever reality diverged from what
  the skill predicted — a tier that behaved differently, a gotcha that bit you,
  a convergence call that needed user input. Encode the specific, checkable rule
  (the exact `tsup` flag, the exact file to touch), not a vague gesture.
- **More to the point.** If a section is longer than the judgment it carries,
  tighten it. Merge duplicated advice. Cut hedging. The skill is read under time
  pressure mid-task; every stale or padded line costs the next reader.
- **More efficient.** If the similarity heuristic mis-ranked something (scored
  two files as similar that a diff showed are not, or vice versa), adjust the
  metric in `scripts/similarity.mjs` and note why. If a step in the discovery
  or extraction flow was wasted motion, remove or reorder it.

Commit the SKILL.md edits in the **same** change as the report or extraction the
run produced.
