---
name: find-refactor-candidates
description: "Use when deciding what to extract into the OSS Framework next. Clones the notes and checklist apps, ranks files by cross-app similarity, and reports the highest-leverage code to mine into reusable components — flagging clusters that should move as a whole module."
---

# Find refactoring candidates

The OSS Framework holds reusable React components, hooks, and utilities for
building local-first PWAs. The richest **source material** is the
functionality `notes` and `checklist` currently maintain as near-duplicate
copies — storage backends, encryption, themes, folders, namespaces,
achievements, i18n, swipe/gesture hooks, modals. This skill finds the next
best thing to mine out of those two apps and turn into a framework component,
ranked so the highest-leverage extractions come first.

It does **not** perform the extraction. It produces the candidate list and
the evidence (similarity, line counts, whole-module clusters) a human or a
follow-up agent uses to decide what to extract, then how.

An extraction's home can be a **new** module _or_ an **existing** component,
hook, or module it enhances — integrating mined behaviour into a surface the
framework already ships is fully encouraged when it's the cleaner fit. See
["An extraction can enhance an existing component"](#an-extraction-can-enhance-an-existing-component--it-neednt-be-a-new-one)
under Extraction conventions.

> **Who consumes the framework — read this first.** The framework targets
> **new, green-field apps** built on top of it. `notes` and `checklist` are
> **source material, not consumers**: their duplicated code is the best
> evidence of what's genuinely reusable, but they will **not** be migrated back
> onto the framework. There is no "remigrate into the source apps" step, and
> nothing about an extraction should be shaped by what those two apps happen to
> render today.
>
> The consequence for every decision below: **optimise for the best possible
> component, not for drop-in compatibility with the source apps.** When two
> copies disagree you are **not** choosing a winning copy to lift wholesale —
> you are **synthesising one best component from the best of each.** Score every
> axis independently (contract cleanliness, capability completeness, naming,
> internal structure, defaults, accessibility) and take the strongest answer for
> each from whichever copy has it — then **invent a better answer where neither
> copy is good.** One copy often has the cleaner contract while the other has the
> richer capability set; the best component takes the clean contract _and_ grafts
> on the extra capability, rather than swallowing either copy as-is. A superset
> of capabilities is a frequent _outcome_ of this per-axis merge, not a copy you
> pick. **Refactor freely while you do it** — renaming, resplitting, reshaping,
> and inventing past both copies during extraction is expected, not scope creep.
> Spend your effort on component quality (clean API, sensible defaults, good
> docs, demo polish), **not** on minimising migration friction for the apps you
> sourced from.

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

| Signal                                                                                                                                        | Interpretation                                                    | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 95% similar, self-contained (a hook, a glyph, an encoder)                                                                                   | Shared verbatim, trivial deps                                     | Extract first. Lift the file, generalize names, add a test, re-export.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 80–95% similar                                                                                                                                | Shared logic with app-specific drift                              | Extract the common core; thread the differences through props / params / a small config object.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| High-similarity **module** (whole `storage/`, `theme/`, `achievements/` cluster)                                                              | A subsystem duplicated wholesale                                  | Plan a module-level migration; don't cherry-pick files that import each other.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| < 80% similar                                                                                                                                 | Genuinely diverged or app-specific                                | Leave in the apps for now; revisit after the cheap wins land.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Any file > 1000 lines (⚠️ in the report)                                                                                                      | Violates OSS_SPEC §20.5                                           | Split by concern _as part of_ extraction — do not import the monolith.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Names baked in (`Note`, `checklist`)                                                                                                          | App-domain coupling                                               | Parameterize or generalize the type before it enters the public API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Copies that were _supposed_ to be identical but **drifted** (different slot counts, extra fields, renamed CSS vars)                           | Accidental divergence, not design                                 | **Synthesise the best component from the best of each — don't pick one copy, and don't preserve both.** Merge per axis: take the **cleaner contract / structure** from whichever copy has it and **graft on the richer capabilities** from the other, so the result is usually a capability superset but _assembled_, not lifted. Do **not** parameterize the engine just to keep both drifted shapes alive; that ossifies the drift instead of building a clean component. Where the two genuinely conflict, choose the cleaner, more general shape **even if neither source app used it verbatim** — invent the better design and refactor to it. Use the ancestor / richer-surface copy as evidence of intent, not as the thing to copy. Ask the user only if the choice has a real product-design cost worth their call (e.g. dropping a capability one copy had). |
| A **store** wrapping shared data (`useSyncExternalStore`, a synced settings doc, persistence keys)                                            | The data is shared; the store is app glue                         | **Leave the store in the app.** Extract the _data_ (types, presets, palettes) and the _pure logic_ it drives (projection, validation/coercion, seeding). The store is usually fused with app-only concerns (achievements, editor prefs, list layout) and must not come along. The app keeps owning where the user's choice lives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Hand-maintained "remove every var/key" cleanup list parallel to a writer                                                                      | Drift bait — the two lists fall out of sync                       | When you extract the writer, make it **track what it wrote** (e.g. a `WeakMap` of written keys) and clear exactly that. One source of truth beats two parallel lists — a quality win worth taking _during_ the extraction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Near-identical **repo tooling** (build/release scripts, CI workflows) duplicated across apps                                                  | Shared process, not shared library code                           | Copy it into the framework's own `scripts/` + workflows and **dogfood** it — don't ship it as an npm export (CLI scripts aren't importable surface). Generalise the app-specific bits (skip-lists, doc-slug examples, deploy env). A component whose data this tooling generates (e.g. `changelog` ← changeset fragments) should land _with_ its tooling so the framework uses the same pipeline it ships.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **App glue** wrapping an otherwise-shareable component (a `Modal`, `useT`/i18n, an icon set)                                                  | UI chrome fused to a portable core                                | **Drop the glue at the seam, don't parameterise it.** Replace the app `Modal` with a self-contained portal (reuse the framework's own primitives, e.g. `useEscapeKey`), i18n with injectable `labels` props (English defaults), and the icon import with inline glyphs. Keep build-tool inlining (`?raw` / `import.meta.glob`) the app's job — take the glob _result_, not the glob.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A **pure engine fused with a domain index** in one file (a matcher + `buildIndex`; a parser + an app-typed AST) scoring **mid-band** (50–60%) | The generic half is verbatim; the whole-file score understates it | **Diff the halves, not the file.** The engine (text matcher, parser, projector) is often byte-identical across apps while the index/result-type half is domain-shaped — comment drift + the domain half drag the score to mid-band, hiding a clean shared-verbatim lift. Extract the engine under a **new name** (`search/matcher.ts`, not `domain/search.ts`), draw the seam at the **corpus** (the engine ranks/parses one input; `buildIndex` + result shapes + navigation stay app-side), and expose the engine as a compile-once / run-many primitive. The original file keeps **ranking** afterward (renamed basename has no twin) but is **done**.                                                                                                                                                                                                              |

Known structural notes about the source apps (keep current):

> Many notes below end with an **"Each app's migration: …"** step (delete the
> app's copy, import from the framework). Those are kept for **provenance** — a
> record of where the surface came from and how the seam was drawn. They are
> **not** work to be done: `notes`/`checklist` are not being migrated onto the
> framework. Read them as "here is what was duplicated and which copy won," and
> don't add new per-app migration steps for future extractions.

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
- **`dev/logger.ts` (in-app logger) — extracted (done).** Lives in the framework
  as `@niclaslindstedt/oss-framework/logging` (`createLogStore` +
  `formatLogLine`/`formatLogTime`). The two apps had **drifted**: notes' logger
  records unconditionally and carries a `time()` helper; checklist's gates
  recording on a `loggingActive()` predicate (its dev-mode flag OR capture) via
  `DEV_MODE_KEY` + `setDevModeEnabled`. The framework **converged on the
  superset**: a `createLogStore({ logsKey, captureKey, maxEntries,
saveDebounceMs, enabled })` factory that keeps `time()` and generalises
  checklist's dev-mode gate to a neutral `setEnabled` activity gate (default
  `enabled: true` = notes' always-record). **App glue dropped at the seam:** the
  hard-coded `notes:`/`checklist:dev:` localStorage keys became constructor
  options, and the `DEV_MODE_KEY` / `useDevMode` React store **stays app-side**
  (it's fused with achievements + cross-tab `storage` sync) — the app just wires
  its flag through `setEnabled`. The **read-only Logs panel** has since been
  extracted as `LogViewer` (level filter, copy, clear, colour-coded entries)
  over a new `useLogs(store)` hook — `getLogs()` returns a fresh array each call,
  which `useSyncExternalStore` can't consume directly, so `useLogs` caches the
  snapshot; visible strings inject via `labels`. What stays app-side is the
  _capture/dev-mode wiring_ (`LogsSection` toggles, `SyncLogPanel`), not the
  list rendering. The verbatim-duplicated `formatLogTime`/`formatLogLine` came
  along earlier. The
  loggers `createLogger` returns satisfy the storage `Logger` sink, so the same
  buffer captures sync diagnostics end to end. Each app's migration: replace its
  logger internals with `createLogStore` on **its existing keys** (so captured
  history survives), seed checklist's `enabled` from its dev flag and forward it
  via `setEnabled`; notes drops the gate entirely. See `src/logging/README.md`.
- **`ui/` UI primitives — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/components`: the `Modal`, `Button`, `Checkbox`,
  `ClearableInput`, `SelectPicker`, the `FloatingPanel` / `DismissBackdrop` /
  `useFloatingPosition` floating-panel kit, `APP_VIEWPORT_RECT`, and a
  dependency-free inline glyph set (`icons.tsx`, a curated **neutral** subset —
  app-domain glyphs like `NoteIcon` / `Cloud*` / `Archive*` stayed app-side).
  The form primitives were **near-identical** across apps; the supporting
  `FloatingPanel` / `useFloatingPosition` / `appViewportRect` had **drifted** and
  the framework took **checklist's superset** (the `grow` width kind + the
  `arrowLeft` pointer; the visual-viewport `--app-top`/`--app-height` tracking).
  **App glue dropped at the seam, not parameterised:** `useT("common.close")`
  became `Modal`'s `closeLabel` prop (English default), the `lucide-react` /
  app-icon imports became the inline glyph set, and `FloatingPanel` reuses the
  framework's own `useEscapeKey` instead of a local copy. **Convergence calls
  made without asking:** `Button` ships a 4-variant **superset**
  (`primary | secondary | ghost | danger`) so neither app's look is lost — the
  filled-neutral (`secondary`) and text-only (`ghost`) buttons both survive; the
  radius drift (`--radius` vs `--radius-sm/md/lg`) resolved onto the converged
  theme's triple (`rounded-md`). The glyph wrapper was de-duplicated into one
  shared `<Glyph>` shell during extraction (a quality win the apps lacked). Each
  app's migration: delete its `Modal` / form / `FloatingPanel` copies and import
  from `/components`, pass its translated labels as props, and switch text-only
  "secondary" buttons to `ghost`. A `SegmentedControl` (a bordered track with
  the active option outlined — the apps' language / layout / menu-mode toggles)
  has since been added to the module, generalising the apps' near-identical
  inline segmented rows. The **settings-layout trio** `Section` / `Field` /
  `ToggleRow` (the apps' `ui/settings/shared.tsx`, ~87% similar) has also landed
  here: a bordered group card, a labelled control row, and a checkbox+label+hint
  row. They were duplicated **three ways** — both source apps, the framework's
  own `theme/AppearancePicker.tsx` (private copies), and the demo — so the
  extraction de-duplicated all three onto one set (`ToggleRow` now uses the
  framework `Checkbox`, not a raw native input). The apps' fourth helper
  `SegmentedRow` was **not** taken: `SegmentedControl` already supersedes it for
  string options, and the one numeric case (`AppearancePicker`'s font-scale row)
  keeps a tiny local `SegmentedRow<number>` since `SegmentedControl<T extends
string>` deliberately rejects numbers. See `src/components/README.md`.
- **`checklist/` nested list — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/checklist`: a **generic** `ChecklistNode`
  (`{ id, label, checked, checkedAt?, children? }`) + the pure tree core
  (`toggleNode` cascade, `setAllChecked`, `countProgress`, `sortCheckedToBottom`,
  `flattenForDisplay`, `subtreeState`) distilled from checklist's
  `domain/checklists.ts`, plus `Checklist` (depth-indented rows, collapse, grips,
  strike-through) and `ChecklistProgress` (the `ItemCount` ring badge). The
  **app domain stayed app-side** per the store rule: checklist's `Checklist` /
  `ChecklistItem` carry `templateId` / `folderId` / `archived` / `notes` /
  `required` / `version` and a whole snapshot/templates/folders model — none of
  that came; the framework took only the **tree shape + mechanics**, generalising
  `title: string` → `label: ReactNode` so an app intersects the node to re-add
  its fields. The cascade + checkedAt-recency + sink-checked semantics were
  preserved verbatim (they're the behaviour, not drift). Also lifted two generic
  primitives into `/components` the list needed: `Badge` (the nav count pill) and
  `Fab` (the create button), plus `Grip`/`Folder`/`FolderOpen`/`Checklist`/
  `Archive`/`CloudCheck` glyphs. The demo was rebuilt to the apps' pure-black +
  green look (a Custom theme) to reproduce the real checklist screen + side menu.
  See `src/checklist/README.md`.
- **`ui/hooks/useRowSwipe.ts` (row swipe gesture) — extracted (done).** Lives in
  the framework as `@niclaslindstedt/oss-framework/hooks` (`useRowSwipe`). The two
  apps were **byte-identical bar comments** (notes ported it from checklist) — a
  clean shared-verbatim lift. Generalised only at the seam: `onArchive` →
  `onDismiss`, and the app pixel constants (`ACTION_W`/`OPEN_AT`/`ARCHIVE_AT`/…)
  became an optional `options` object defaulting to those values. The hook owns
  the gesture math only; the foreground/strip **markup stays the caller's** (it
  hands back `offset`/`animating`/`open`/`close`/`handlers`). It was then
  **consumed inside the framework's own `Checklist`**: an optional `onDelete`
  (+ `deleteLabel`) wraps each row in the strip/foreground and maps **both**
  swipe outcomes (left-latch + right-flick) onto delete — the apps' richer
  two-direction row (archive one way, delete the other) is left app-side over the
  bare hook, since `Checklist` models the single-action case. A pure
  `removeNode(nodes, id)` tree helper landed alongside for the deletion. The demo
  wires `onDelete` through its store's undo history. See `src/hooks/README.md`.
  **The `hooks/` module now carries a README** (it had none through `useEscapeKey`).
- **`glyphs/` glyph + accent-colour picker — extracted (done).** Lives in the
  framework as `@niclaslindstedt/oss-framework/glyphs`: the inline-SVG glyph
  catalogue (`GLYPH_PATHS`, `DEFAULT_GLYPH`, `GLYPH_NAMES`, `isGlyphName`), the
  `Glyph` renderer (was `NamespaceGlyph`), the two presentational pickers
  `GlyphPicker` (was `GlyphGrid`) + `ColorPalette`, the default `GLYPH_COLORS`
  palette (was `namespace-colors.ts`), and the favicon builders
  `glyphSvg`/`glyphDataUri` (was `namespaceGlyph*`). The two apps were
  **near-identical** (95–100%); the catalogues had **drifted** (notes carried
  `pen` and lacked `cart`/`car`/`wallet`; checklist had those and lacked `pen`)
  so the framework took the **superset** — checklist's set plus `pen`. **App
  glue dropped at the seam:** the `Namespace` naming was generalised away (the
  module is entity-neutral — "a list, a workspace, a category"), the `t(…)`
  i18n became `noneLabel`/`ariaLabelPrefix` props (the pickers already took
  them), and the hard-coded `FAVICON_BG = "#1f2933"` filled badge became an
  optional `GlyphBadgeOptions` (`size`/`radius`/`background`/`padding`),
  defaulting to a **transparent** badge. **The store stayed app-side** per the
  rule: where an entity's picked `glyph`/`color` lives (the namespace doc, the
  list) is the app's; only the catalogue + rendering + picker chrome moved. The
  demo gained a per-list appearance feature (each list carries `glyph`/`color`):
  the side-menu rows render the tinted `Glyph`, the screen header opens a
  `FloatingPanel` appearance popover (`ColorPalette` + `GlyphPicker`), and the
  tab favicon re-badges to the active list via `glyphDataUri`. Each app's
  migration: delete its `NamespaceGlyph`/`GlyphGrid`/`ColorPalette`/`glyphs.ts`/
  `namespace-colors.ts` and import from `/glyphs`, pass `{ background: "#1f2933" }`
  to keep the filled favicon badge, and keep its namespace store untouched. See
  `src/glyphs/README.md`.
- **`ui/hooks/useEdgeSwipeOpen.ts` (edge-swipe to open) — extracted (done).**
  Lives in the framework **inside the `sidebar` module** (not `hooks`) as
  `@niclaslindstedt/oss-framework/sidebar` (`useEdgeSwipeOpen`). It belongs there,
  not in `hooks`: it imports `MenuButtonSide` (a sidebar type) and is the
  conceptual mirror of `useDrawerSwipeClose`, so putting it in the leaf `hooks`
  module would violate the one-way dependency rule (hooks must not import a
  feature-module type). The two apps were **byte-identical bar comments and the
  `MenuButtonSide` import** (notes from `sideMenuPosition`, checklist from
  `settings/types`) — a clean shared-verbatim lift; the import now resolves
  locally to `./position.ts`, where the type already lived from the sidebar
  extraction. Generalised only at the seam, per the `useRowSwipe` precedent: the
  app pixel constants (`EDGE_ZONE`/`OPEN_DISTANCE`) became optional `edgeZone`/
  `openDistance` options defaulting to `30`/`48`. The hook owns the gesture only
  (touch-only, stands down while an `[aria-modal="true"]` element is open,
  ignores a mostly-vertical drag); the host owns the open state and the
  resting-side choice. The `Sidebar`'s `showButton={false}` path already
  anticipated it. **Demo:** the already-present-but-inert "Open the menu with"
  setting (`menuMode: "swipe" | "button"`, Settings → General) is now wired —
  swipe mode hides the floating button and opens the drawer via the edge swipe;
  the default flipped to `"button"` for first-run discoverability. See
  `src/sidebar/README.md`.
- **`FloatingButton` (draggable FAB) — extracted in place (done).** The round,
  edge-resting floating button lived inline inside `Sidebar.tsx`; it was lifted
  into its own `src/sidebar/FloatingButton.tsx` and `Sidebar` now consumes it
  (no behaviour change — same `useDraggableMenuButton` drag/snap, same
  `consumeDragClick` tap-vs-drag handling, same styling). It stays in the
  `sidebar` module, **not** `components`: it needs `useDraggableMenuButton` +
  `MenuButtonPosition`, both sidebar-local, and `components` must not import a
  feature module. Now exported from `/sidebar` so an app can float a **second**
  global action from the same primitive (each instance owns its `position`).
  **Demo:** a floating **settings** button (default, resting on the right edge,
  opposite the left-resting menu button) opens the Settings dialog on phones; a
  new "Open settings with" General-tab setting (`settingsMode: "swipe" |
"button"`, default `"button"`) flips it to an inward edge swipe via
  `useEdgeSwipeOpen`, mirroring the menu pattern. Both are phone-only; wide
  screens keep the docked menu's Settings footer row. See `src/sidebar/README.md`.
- **`ui/CipherGlyph.tsx` (encryption busy indicator) — extracted (done).** Lives
  in the framework as `@niclaslindstedt/oss-framework/components` (`CipherGlyph`).
  The two apps were **byte-identical bar comments** (notes ported it from
  checklist) — a clean shared-verbatim lift. It is a dependency-free animated
  span (React only, no domain types, no i18n): a run of re-scrambling monospace
  cipher glyphs used **in place of a spinner** for the encryption status bar +
  the unlock gate. Generalised only at the seam: the comment's app-surface
  references were softened to neutral terms. It belongs in `components/` (a UI
  primitive), **not** a future `encryption/` module — it is purely
  presentational and the apps use it as a generic busy indicator. The
  reduce-motion contract (OS `prefers-reduced-motion` + the theme engine's
  `<html data-reduce-motion="true">`) carried over verbatim. **Demo:** wired into
  the Settings → Storage playground as the busy indicator fronting the async
  `StorageAdapter` `save`/`reload` — because the localStorage backend resolves
  sub-frame, the tab holds it on screen for a `BUSY_MIN_MS` anti-flicker window
  (a standard spinner beat) so the animation reads. See `src/components/README.md`.
- **`ui/hooks/usePullToRefresh.ts` + `ui/PullToRefreshIndicator.tsx`
  (pull-to-refresh) — extracted (done).** A hook/component **pair** split across
  two existing modules: the gesture hook lands in `@niclaslindstedt/oss-framework/hooks`
  (`usePullToRefresh`, `PullToRefreshState`), the slide-down pill in
  `@niclaslindstedt/oss-framework/components` (`PullToRefreshIndicator`). The
  **hook was byte-identical code bar comments** across the apps (a clean lift);
  the **indicator** differed only at the i18n seam and the already-resolved
  radius drift (`rounded-[var(--radius)]` → `rounded-sm`, the converged theme).
  **App glue dropped at the seam:** `useT(...)` became injectable `labels`
  (English defaults `PullToRefreshLabels`); the icons resolve to the framework's
  own `components/icons.tsx` (`ArrowDownIcon`/`SpinnerIcon` already lived there).
  **No new subpath wiring** — both modules already export, so the lift was just
  two files + two barrel lines. The `components → hooks` type import
  (`PullToRefreshState`) is fine: that direction was already established
  (`FloatingPanel` imports `useEscapeKey`); only the leaf `hooks` must not import
  _up_. **Demo:** the list screen's previously-static "In sync" `CloudCheckIcon`
  header button is now live — a `reload()` was added to `useChecklistStore` (re-reads
  the persisted doc, picking up another tab's edits, off the undo history), and a
  screen-local `sync()` (min-delay + `reload`) is driven **both** by a tap on the
  glyph (which flips to a spinning `RefreshIcon`) and by the pull-to-refresh
  gesture, with `PullToRefreshIndicator` overlaying the screen. See
  `src/hooks/README.md` and `src/components/README.md`.
- **`ui/hooks/useUndoRedoShortcuts.ts` (global undo/redo chords) — extracted
  (done).** Lives in the framework as `@niclaslindstedt/oss-framework/hooks`
  (`useUndoRedoShortcuts`, `UndoRedoShortcutsParams`). The apps had **drifted**
  only at the seam: notes' copy lacked the `enabled` gate checklist's carried, so
  the framework took **checklist's superset** (the `enabled` flag, default
  `true`) — a clean shared-verbatim lift otherwise (same chord set Cmd/Ctrl+Z ·
  Cmd/Ctrl+Shift+Z / Ctrl+Y, same editable-element bail-out, same
  `preventDefault` on an acting chord). A leaf hook: it holds no state and
  imports nothing from the feature modules — **the history stays the app's**
  (you pass `canUndo`/`canRedo` + the `onUndo`/`onRedo` steppers from your
  store). **Demo:** the side menu already had Undo/Redo **buttons** over
  `useChecklistStore`'s history but no keyboard path; the hook is wired in
  `App.tsx` with `enabled: pinned || !drawerOpen` (silence the chords while a
  phone drawer owns the screen, always live when the sidebar is docked),
  exercising the superset gate exactly as designed. See `src/hooks/README.md`.
- **`ui/hooks/useMediaQuery.ts` — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/hooks` (`useMediaQuery`, `useDesktopPointer`).
  The apps were **byte-identical bar comments** (the 72% score was comment drift)
  and it was duplicated **three ways** — notes, checklist, **and the demo's own
  `demo/src/app/useMediaQuery.ts`** — so the lift de-duped the demo too (its local
  copy deleted, now imports `/hooks`). The framework took **checklist's superset**
  (the `useDesktopPointer()` named query `(hover: hover) and (pointer: fine)`).
  The only generalisation was an SSR guard hoisted into the synchronous initial
  read (`typeof window !== "undefined" && window.matchMedia`). To avoid a dead
  export, `useDesktopPointer` was given its **canonical use**: the framework
  `Checklist` was **widened** with an optional `onRowContextMenu?(id, e)` prop
  (forwarded from both the plain `<li>` and the swipe-row foreground), and the
  demo wires it — gated on `useDesktopPointer()` — to a cursor-positioned
  right-click menu (`demo/src/app/RowContextMenu.tsx`, Copy text / Delete item)
  that mirrors the touch swipe-to-delete a mouse can't reach. `Checklist` only
  **forwards** the `contextmenu` event; the demo owns the menu chrome (reusing
  the framework's own `DismissBackdrop` + `useEscapeKey`) and the actions.
  Testing `useMediaQuery` in jsdom needs a fake `matchMedia` whose `matches` is a
  **live getter** (not a snapshot) — the hook re-reads `mql.matches` on each
  `change`, so a snapshot never reflects a flip. See `src/hooks/README.md`.
- **`pwa/` (service-worker update + install detection) — extracted (done).**
  Lives in the framework as `@niclaslindstedt/oss-framework/pwa`: `usePwaUpdate`
  (the SW update-lifecycle singleton), `UpdateToast` (the reload prompt), and
  `isStandaloneMobile`/`useStandaloneMobile`. The whole `pwa/` cluster was
  **near-identical bar comments**: `standalone.ts` was byte-identical apart from
  the comment block; `usePwaUpdate.ts` (319 lines) differed **only** in comments
  plus the one app-specific seam — the precache `cacheIdForBase` (`notes` vs
  `checklist`). The seam was generalised by **removing the `import.meta.env`
  coupling entirely** (the storage precedent: push env to the app), turning the
  hook into `usePwaUpdate({ base, cacheId, enabled })` — `import.meta.env.DEV` →
  `enabled`, `BASE_URL` → `base`, and the per-deploy-slot `cacheIdForBase` logic
  (`-preview`/`-branch`) dropped to the app (it passes a resolved `cacheId`).
  Removing `import.meta` also sidesteps the CJS-build problem (esbuild can't emit
  `import.meta` to CJS). `UpdateToast` had **drifted**: notes computed the
  docked-sidebar inset inline via `useNav()`, checklist read the
  `--app-content-{left,right}` CSS vars `useSidebarInset` already publishes — the
  framework took **checklist's** version (it reuses the already-extracted sidebar
  inset) and **inverted the container/presentational split**: the apps called
  `usePwaUpdate()` _inside_ the toast, but the framework makes `UpdateToast`
  **props-driven** (`needRefresh`/`incomingVersion`/`onReload`/`onDismiss`) so
  the singleton's state can feed several surfaces (the prompt _and_ a header
  progress fill — checklist's `progress` drives a wordmark). App glue dropped at
  the seam: `useT` → `labels` (English defaults), the app icons →
  `components/icons` (`RefreshIcon`/`CloseIcon`), the radius drift → `rounded-sm`.
  **`workbox-window` is an optional peer dep** handled exactly like
  `@fontsource/*`: lazy `import("workbox-window")`, **ambient `declare module`**
  in `src/pwa/workbox-window.d.ts` (no devDep, keeps the framework dep-free at
  type-check), `external` in `tsup.config.ts`, and a `tests/stubs/workbox-window.ts`
  aliased in **both** `vitest.config.ts` and `demo/vite.config.ts`. Each app's
  migration: delete its `pwa/` copies, import from `/pwa`, pass its `BASE_URL` /
  resolved `cacheId` / `!DEV` as config, lift the hook above the toast, and pass
  translated `labels`. See `src/pwa/README.md`.
- **`achievements/` (gamification subsystem) — extracted (done).** Lives in the
  framework as `@niclaslindstedt/oss-framework/achievements`: the engine generic
  over a `TState` type param (`Trigger<TState>` / `Achievement<TState>`,
  `TIER_POINTS`/`TIER_ORDER`, `deriveUnlocks<TState>`), the manual-unlock `bus`
  (`unlock`/`subscribe`/`drain`/`resetBus`), `useAchievementWatcher`, and the UI
  (`AchievementsModal`, `AchievementUnlockModal`, `TrophyButton`). The cluster was
  **identical bar comments + one app-domain noun**; the clean engine-over-catalog
  seam held. **What stayed app-side:** `catalog.ts` (~620 lines — the concrete
  entries + predicates, domain-coupled) and the concrete `AchState` shape, which
  became the `TState` type argument. **Convergence calls made during extraction
  (the source shapes were _improved_, not preserved):**
  - **Display copy moved onto the entry.** Both apps kept `name`/`condition`/
    `learnMore` in a parallel i18n table keyed by id and carried a `hasLearnMore?`
    _flag_. The framework instead carries `name`/`condition`/`learnMore?` as
    `ReactNode` **on the `Achievement` entry** — so `hasLearnMore` is redundant
    and was dropped (`learnMore != null` is the flag). The earlier "converge onto
    `hasLearnMore?`" note was wrong for a green-field component; inline copy with
    no parallel table is the better design. An i18n app fills the fields from its
    translator when it builds the catalog.
  - **App glue dropped at the seam:** `useT`/i18n → injectable `labels`
    (English defaults `DEFAULT_*`); the app `Modal` + icons → the framework's own
    `/components` (`Modal`, `CheckIcon`/`CloseIcon`/`LockIcon`). Only the trophy +
    four tier glyphs are shipped as module chrome (`glyphs.tsx`); the
    per-achievement glyphs are the catalog's choice (any `Glyph`).
  - **`TrophyButton` was generalised, not lifted.** The source button was a
    side-menu row fused to the app's `modal-bus` + `achievements-context`; the
    framework ships a **presentational** icon button (glyph + count badge,
    `onClick`, restyle via `className`) and lets the caller decide tour-vs-unlock.
  - **Name collision gotcha:** the achievements `Glyph` _type_ clashes with the
    `glyphs` module's `Glyph` _component_ under the root `export *`. The barrel
    re-exports it as **`AchievementGlyph`** to keep `src/index.ts` unambiguous —
    watch for this whenever two modules export the same identifier.
  - **`useAchievementWatcher` generalised the state shape:** the apps' two-island
    `{ snapshot, settings }` + `settings.achievements` map became `state: TState`
    - an `unlocked` map + a `record` writer, with `enabled` defaulting to `true`.
      The per-render `prev === state` short-circuit needs a referentially-stable
      `state`; the per-predicate `slices` extractor still gives finer skipping.
      See `src/achievements/README.md`. **Demo:** the previously-inert
      `disableAchievements` setting is now real (flipped on by default) — a `/glyphs`-
      styled `TrophyButton` sits in the list-screen header, opening the
      `AchievementsModal` tour (quiet) or `AchievementUnlockModal` (lit). A demo
      catalog (`demo/src/app/achievements.ts`, 8 trophies over the checklist doc) +
      an app-side store (`useAchievements.ts`) drive it; **first run retroactively
      awards the seed-satisfied trophies via the pure `deriveUnlocks`** (the watcher
      is forward-going only, so a rich seed would otherwise read as all-locked), and
      `Clean Sweep` (check-all) + `Time Traveler` (undo → manual `unlock`) are earned
      live, lighting the button + firing the unlock modal.
- **`encryption/` (at-rest crypto + adapter wrapper) — extracted (done).** Lives
  in the framework as `@niclaslindstedt/oss-framework/encryption`: the pure
  envelope crypto (`encryptText`/`decryptEnvelope`/`parseEnvelope`/
  `isEncryptedEnvelope` over a self-describing AES-GCM + PBKDF2 JSON `Envelope`)
  and `withEncryption(inner, passwordRef, { logger? })` — a higher-order
  `StorageAdapter` that enciphers on `save` and decrypts on `load`. `crypto.ts`
  had **drifted hard** (the storage pattern again): notes' copy (373 lines) was
  fused with per-file/attachment **session keys** + gzip compression + a
  deterministic-filename HMAC; checklist's (181 lines) is the clean,
  envelope-only whole-document format — the framework took **checklist's clean
  contract** as canonical. `withEncryption` (the `encrypting/index.ts` HOA) was
  **byte-identical bar comments**; the framework took **checklist's superset**
  (it forwards `probe` + `getRevision`; notes' didn't). **App glue dropped at the
  seam:** the apps' `createLogger("encrypt")` became an injectable `Logger` from
  the storage module (default `noopLogger`); crypto.ts's `deriveKey` timing log
  was **dropped to keep crypto zero-dependency** (the wrapper times the round
  trip with the injectable logger instead — the better seam); and the envelope
  tag generalised from `checklist.encrypted.v1` to a neutral `oss.encrypted.v1`
  (fixed, not configurable — a green-field app doesn't migrate old blobs).
  **What stayed app-side (the store rule):** `useEncryption.ts` is a React store
  fused with the achievements bus + `backend-preference` + the offline cache —
  only the pure crypto + the wrapper moved. The **i18n-coupled** bits also stayed:
  `ui/encryption-progress.ts` (maps progress steps → i18n `MessageKey`s) and
  `ui/UnlockGate.tsx` (a full-screen prompt fused with `useT` + the storage
  backend hook) — the demo builds its own small unlock UI over the bare module.
  **The architecture's "encrypt/decrypt migration queue" did NOT come:** notes'
  `encryption-migration.ts` is attachment-coupled and notes-only — the module is
  the crypto + the wrapper. **Demo:** the Settings → Storage playground gained an
  "Encryption at rest" section (a `ToggleRow` + passphrase) that wraps its
  localStorage adapter with `withEncryption`; a "Bytes on disk" panel reveals the
  raw `localStorage` value (plaintext vs the `oss.encrypted.v1` envelope JSON); a
  "Lock (simulate reload)" button drops the in-memory passphrase and an unlock
  prompt re-decrypts (wrong password surfaces the framework's "Wrong password"),
  modelling the locked-after-reload lifecycle a real app has; and the wrapper's
  diagnostics route into the demo's in-app log buffer (the `encrypt` scope the
  Logs tab already seeded). See `src/encryption/README.md`.
- `theme/themes.ts` in each app also holds **non-theme** settings (notes:
  `EditorSettings`, `ListLayout`, `FolderPlacement`; both: misc prefs). Those
  are app-specific — do not pull them into the framework's `theme` module.
- `storage/useStorageBackend.ts` is the largest shared file (~2000 lines) and
  blows the §20.5 limit — it must be decomposed during extraction, not lifted.
- **`i18n/` (typed `t()` runtime) — extracted (done).** Lives in the framework
  as `@niclaslindstedt/oss-framework/i18n`: `createI18n(config)` — a **factory**
  that returns a fully-typed runtime (`useT`/`useLang`/`LanguageRoot`/
  `LanguageProvider`/`ensureCatalog`/`isCatalogLoaded`/`tFor`/`setLanguage`/
  `readLanguagePreference`/`writeLanguagePreference`) over an app's own catalogs,
  plus `detectBrowserLanguage`/`formatMessage`/`flattenCatalog` and the
  `Widen`/`Leaves`/`CatalogShape`/`I18nConfig`/`I18n` types. The four machinery
  files (`index.ts`, `locale.ts`, `language-preference.ts`, `LanguageRoot.tsx`)
  were **comment-only drift** across the apps; the real work was **inverting the
  module-level singletons into a closure factory** so a green-field app (or a
  test, or a second mount) holds an independent runtime — the apps' `flatEn`/
  `flatCatalogs`/`CATALOG_LOADERS`/`inFlight` module globals and the hard-coded
  `Catalog`/`Lang`/`sv`-loader become factory generics + config. **App glue
  dropped at the seam:** the hard-coded `notes/language` / `checklist:settings:
language` localStorage keys and `notes:language` / `checklist:language` events
  became `storageKey`/`eventName` config (defaults `oss.language`/`oss:language`);
  the apps' `bcp47`/`detectInitialLanguage` (which languages exist — app data)
  became injectable `toBcp47`/`detectLanguage` with sensible defaults
  (identity / `navigator.language` prefix match). **`LanguageRoot` took notes'
  clean shape, not checklist's** (checklist fused `ToastProvider` + `UpdateToast`
  chrome into it) — the framework's `LanguageRoot` provides language + gates first
  paint + tracks `<html lang>` (notes' accessibility superset); mounting a toast
  stays the app's job. **The locale _tables_ stayed app-side** (translations
  diverge — not reusable): the framework ships **no locale data**, only the
  machinery. **Demo:** the previously-inert language setting is now real — the app
  has its own `demo/src/app/i18n/` (en + code-split sv catalogs over `createI18n`),
  `main.tsx` wraps `<App>` in `LanguageRoot`, and `useT()` drives the side menu,
  screen header, and the whole Settings dialog; the `LanguagePicker` now reads
  `useLang()`/`setLanguage()` so picking Svenska re-renders the entire UI live
  (language moved **out of** `AppSettings` — the i18n runtime owns the preference,
  like a real app). See `src/i18n/README.md`.
- **`namespaces/` (named buckets / workspaces) — extracted (done).** Lives in
  the framework as `@niclaslindstedt/oss-framework/namespaces`: the `Namespace`
  data shape + `NamespaceAppearance`, the **pure list transforms** over an
  immutable `Namespace[]` (`normalizeNamespaces` default-first/dedup,
  `parse`/`serializeNamespaces`, `slugify`, `addNamespace` → `{ list, created }`,
  `renameNamespace`, `setNamespaceAppearance`, `removeNamespace`, the connect-time
  `mergeNamespaceLists` / `hasLocalOnlyNamespaces` reconcile), the favicon
  resolver (`namespaceFaviconHref` + `applyFaviconHref`), and the presentational
  `NamespacesModal`. The cluster was **store-heavy** as predicted, so the seam
  was drawn exactly at the store rule: **the registry and the active-namespace
  pointer stay app-side**, and so does **the slug→storage-location mapping**
  (`namespaceLocalKey` / `namespaceCloudFolder` / `namespaceNotesFolder` —
  app/backend-coupled and **drifted** between the apps anyway: notes' default
  owns the app-folder root + a `notes/` subfolder, checklist's default gets a
  `default/` folder) and the `fileNamespaceStore` / `useNamespaceRegistry`
  registry glue. checklist's `getActiveChecklistId` cursor + notes'
  attachment-folder helpers were domain-coupled extras left behind. The module
  ships **only the pure transforms + favicon + UI** — every localStorage
  read/write became a pure list transform the app feeds its own store. **App glue
  dropped at the seam:** the modal's `useT` → injectable `labels` (English
  defaults; two `(name) => string` entries interpolate), the app `Modal` /
  `GlyphGrid` / `ColorPalette` / `NamespaceGlyph` / `ConfirmDialog` → the
  framework's own `/components` + `/glyphs`, and the favicon's
  `import.meta.env.BASE_URL` fallback → a passed-in `fallbackHref` (the storage
  precedent — push the bundler-specific bit to the app, keeps it CJS-safe). The
  catalogues default to `GLYPH_NAMES` / `GLYPH_COLORS` (the apps' `NAMESPACE_*`
  copies, already extracted to `/glyphs`). A new **`ConfirmDialog`** primitive (+
  `AlertTriangleIcon`) landed in `/components` to back the modal's delete confirm
  (checklist had it; notes used an inline two-tap confirm — the framework took
  checklist's cleaner separate-dialog design). The two apps had **drifted**: the
  modal (checklist used `ClearableInput` + `ConfirmDialog` + a `noneGlyph`; notes
  raw `<input>` + inline confirm) converged on checklist's superset. See
  `src/namespaces/README.md`.
- **`storage/migrations.ts` (versioned-document migration runner) — extracted
  (done).** Lives in the framework **inside the `storage` module** (not a new
  subpath) as `createMigrator` (`@niclaslindstedt/oss-framework/storage`). The
  **runner was byte-identical bar comments** across the apps (the ~49% score was
  comment + table drift) — a clean engine-over-catalog lift, exactly like
  achievements: the loop, the v0 coercion (`numericVersion`, non-object →
  `{version:0}`), the newer-than-build guard, and the missing-step guard all came
  verbatim. **What stayed app-side (the store/catalog rule):** the migration
  **table** (the concrete `0:`/`1:` steps — `notes`'s `liftTitle`, checklist's
  `templates`/`checklists` bootstrap) and `LATEST_VERSION` are the app's data
  model, injected through `createMigrator({ migrations, latestVersion, logger })`;
  the apps' module-level `migrate(raw)` (table as a module global) inverted into
  the factory so a green-field app holds its own chain. **App glue dropped at the
  seam:** the apps' `createLogger("migrate")` became the storage `Logger` seam
  (default `noopLogger`) — the one "migrated vX → vY" line routes wherever the app
  points it. The returned `Migrator` also re-exposes `latestVersion` so an app's
  serialize step stamps the same constant it migrates against (one source of
  truth). Versioning stays a property of the bytes at rest — the in-memory model
  is version-free. **Demo:** the previously-unversioned document is now versioned
  — `useChecklistStore` runs `migrator.migrate` on load and stamps
  `LATEST_VERSION` on write (a demo chain in `demo/src/app/migrations.ts`: v0→v1
  bootstrap, v1→v2 lifting legacy `string[]` items into `ChecklistNode`s), and the
  Developer tab gained a **"Document migrations"** section whose "Load a legacy
  document" button drops a real pre-versioning file on disk and re-reads it, so
  the runner climbs it v0→v2 live (the upgrade logs "migrated v0 → v2" into the
  Logs tab). See `src/storage/README.md` (the "Versioning the bytes" section).
- **`storage/save-retry.ts` (save-path retry policy) — extracted (done).** Lives
  in the framework **inside the `storage` module** (not a new subpath) as
  `backoffDelayMs` / `isRetryableSaveError` / `MAX_TRANSIENT_SAVE_RETRIES` /
  `OFFLINE_RESUME_MS` (`@niclaslindstedt/oss-framework/storage`). This was the
  **cheap precursor** the sync-status note named, and a clean shared-verbatim
  lift: the apps were **byte-identical bar comments**, checklist carrying one
  extra constant (`OFFLINE_RESUME_MS`) — the framework took **checklist's
  superset**. **Heuristic miss to remember:** `similarity.mjs` scored it **37%**
  (below the default `--min 50`, so it never showed in the report) purely from
  **comment drift** — the executable code is identical. When the "extract next"
  note names a sub-50% file by hand, trust the diff over the score; run
  `--min 30` to surface comment-heavy near-twins. **The policy is shared; the
  engine that applies it stays app-side** — `backoffDelayMs` is pure (injectable
  `rand` for tests), `isRetryableSaveError` excludes only the three typed adapter
  signals (`Conflict`/`Auth`/`RateLimit`, each with dedicated upstream handling),
  and the save queue / `setTimeout` / dirty-flag plumbing is fused with the app's
  document store and did not come. **Demo:** the Settings → Storage playground
  gained a **"Simulate a flaky backend"** toggle (`StorageTab`, `tabs.tsx`) — when
  on, the next save injects `FLAKY_FAILURES` (3) transient errors before the real
  write, and the playground's save loop runs the framework policy (snappier
  `DEMO_BACKOFF` so retries read in ~1–2s), surfacing "transient failure —
  retrying in Nms (k/4)" mid-flight then "saved after 3 retries — it persists",
  with each attempt logged under a new `save` scope routed into the demo's log
  buffer (Logs tab). See `src/storage/README.md` (the "Retrying the save path"
  section).
- **`sync/` (sync-status surface) — extracted (done).** Lives in the framework
  as `@niclaslindstedt/oss-framework/sync`: `SyncStatus` (the header glyph
  morphing over a `SaveStatus` union + `dirty`/`offline`, opening the details)
  and `SyncDetailsModal` (the command centre — headline status + _why_, Save now
  / Reconnect / Reload / Check connection, the backend + at-rest-encryption +
  file-location grid, an optional collapsible developer log), plus the
  `SaveStatus` / `ConnectionProbeResult` / `BackendKind` / `SyncLocation`
  contract and injectable `SyncStatusLabels` / `SyncDetailsLabels`. The two apps
  had **converged** on the same `SaveStatus` union already (both carry the
  `throttled`/`auth-error` superset), so that lifted clean; the **tone set**
  drifted (notes `ok|busy|warn|err|push`, checklist `ok|busy|warn|err|accent|flag`)
  and the framework took **checklist's richer superset** (matches the converged
  18-slot theme). **Per-axis merge, not a copy:** the modal took **checklist's
  cleaner base** (no attachment/encryption-conversion/upload fusion notes' copy
  carried) but grafted on **notes' explicit `encrypted?: boolean` prop** — dropping
  checklist's hack of parsing an `(encrypted)` suffix off `providerName`. **Seam
  drawn hard at the store:** the apps computed the path/URL from a `BackendId` +
  the namespace folder mapping (`namespaceCloudFolder` + `DROPBOX_APP_FOLDER` +
  `dropboxWebUrl`/`gdriveWebUrl`) inline — all of that **stays app-side**; the
  framework takes a resolved `location: { path, url }` instead, so the component
  imports no storage layer. `backendGlyph` generalised from `BackendId` to a
  `backendKind: "cloud" | "folder"` prop. **App glue dropped at the seam:** `useT`
  → injectable `labels` (English defaults), the app `Modal`/`Button`/icons → the
  framework's own `/components` (six new icons added: `CloudIcon`,
  `CloudAlertIcon`, `CloudOffIcon`, `CloudUploadIcon`, `ShieldIcon`,
  `ScrollTextIcon`), and the **developer log inverted to a slot**: the apps fused
  `useDevMode` + a `SyncLogPanel` reading the logger ring buffer + a
  `SYNC_LOG_SCOPES` filter _inside_ the modal; the framework exposes an optional
  `logPanel?: ReactNode` (the collapsible "View sync log" chrome stays, the
  content + dev-mode gate go app-side — pass the framework's own `LogViewer`).
  **Every action handler is optional** (`onSaveNow`/`onReload`/`onReconnect`/
  `onCheckConnection`) — omit one and its affordance simply doesn't render, so a
  local-only app and a cloud app share one surface. **The store stayed app-side**
  as predicted: the apps' `use-*-sync.ts` engines (the save queue, the conflict /
  auth / throttle handling, the offline mirror) did **not** come. **Demo widened
  with a simulated sync engine** (the recommendation's prerequisite): a new
  app-side `useMockSync(store, slug)` watches the document store's edit counter
  for `dirty`, debounces a fake cloud round trip (Saving → Saved), and lets the
  Developer tab inject the faults (offline / expired session / conflict /
  rate-limit) that exercise the command centre. The list-screen header's bespoke
  "In sync" glyph was **replaced** by the framework `SyncStatus` (pull-to-refresh
  stays the read-side gesture; the glyph is the write-side status and opens the
  modal); Settings → Storage gained a **"Where your data lives"** section (a
  `SegmentedControl` This device / Simulated cloud + an "Encrypt at rest"
  `ToggleRow`); Settings → Developer gained a **"Sync faults"** section. The
  engine logs its round trip under a `sync` scope routed into the demo's log
  buffer, so the modal's dev log slot (`LogViewer`, gated on dev mode) shows real
  activity. See `src/sync/README.md`.
- **`search/` (full-text search) — extracted (done).** Lives in the framework as
  `@niclaslindstedt/oss-framework/search`: the pure progressive-query **matcher**
  (`compileQuery` → `{ isEmpty, invalidRegex, match(text) }`, `searchItems`,
  `segmentMatches`, `clipAround`, `MatchRange`/`TextMatch`), the `Highlighted`
  `<mark>` renderer, and the generic **`SearchModal<T>`** overlay. The headline
  finding that reshaped the extraction: the **matcher engine** in both apps'
  `domain/search.ts` (`parseQuery` + substring/fuzzy/wildcard/regex matchers +
  `mergeRanges` + `segmentMatches`) was **byte-identical** — the 54%/55% scores
  were dragged down by comments and the **domain-coupled** halves
  (`buildSearchIndex` walks notes vs checklists; the result types `NoteResult`
  vs `ChecklistResult`/`ItemMatch`). So the real jewel was the matcher (a clean
  shared-verbatim lift), not the modal. **The seam was drawn at the corpus, not
  the chrome:** the matcher ranks one string at a time; `buildSearchIndex` + the
  per-group result shapes + navigation stay app-side. **Per-axis merge:** the
  apps' `SearchModal` had **drifted** (notes flat per-note `ResultRow`; checklist
  grouped per-checklist `ResultGroup` + `ItemRow` + a `MAX_ITEMS_PER_LIST` cap) —
  the framework took **neither result renderer**, inverting to a render-prop
  (`children(results, close)`) so the app owns the rows entirely; the modal owns
  only the field, the empty/prompt/invalid/no-results state machine, and the
  `results.length` count. **App glue dropped at the seam:** `useT` → injectable
  `labels` (English defaults; `noResults`/`matches` are functions);
  the app `Modal`/icons → the framework's own `/components`; the achievements
  `unlock("seeker")` → an optional `onQueryChange(trimmed)` callback (the
  analytics/achievement seam). `clipAround` generalised the apps' `clipBody`/
  `clipNote` (drifted only in the `140` vs `160` constant → a `width` param).
  **The store stayed app-side:** `buildSearchIndex`, the index memo, and the
  per-list/per-note grouping are the app's; the matcher is fed whatever text the
  app has in memory (the README's "deferred fields" note covers the encrypted-
  body case notes handled via a `preview` projection). **Demo:** the
  previously-inert side-menu **search button** now opens a `SearchModal` over the
  document; an app-side `search.ts` builds per-list groups (title + items, walked
  recursively) over `compileQuery`, and `SearchOverlay.tsx` renders the groups
  (`Highlighted` title + indented item rows) — picking a result `setActive`s that
  list and closes. A 9th **"Seeker"** achievement (manual, fired from
  `onQueryChange`) was added to the demo catalog. See `src/search/README.md`.
- **Extract next (recommendation, after `search`):** the cheap shared wins, the
  whole sync surface, and now search are mined; what's left in the ≥ 50% band is
  **store-heavy or app-domain** and shrinks to little once the store rule is
  applied. The per-file ranking below the already-done entries is
  `storage/backend-preference.ts` (65% — the backend-id enum + the persisted
  preference; the _enum_ + the pure default-resolution could come, but it's
  mostly a tiny store), `dev/useDevMode.ts` (67% — a React store fused with the
  cross-tab `storage` event + achievements, **store rule says leave it**), and
  `ui/modal-bus.ts` (64% — a global event bus for opening modals; app glue, not
  reusable surface). `domain/search.ts` (55%) still **ranks** — its basename has
  no framework twin (the matcher landed as `search/matcher.ts`) — but it is
  **done**: the shared matcher was lifted out of it and the rest (`buildSearchIndex`
  - the `Note`/`Checklist` result types) is app-domain. The realistic remaining
    pulls are all **app-domain or store glue** — there is no clear next
    shared-component candidate in the band; the next run should re-clone (the apps
    may have moved) and, if nothing new surfaces, report that the high-similarity
    seam is **exhausted** rather than forcing a thin extraction. When a real
    candidate does appear, remember the store rule shaves a store-heavy cluster
    down to its pure core — scope to that core up front, and expect to **widen the
    demo** to give the new surface a real home.
- **Known false positives in the ranking (already extracted, but _renamed_).**
  `similarity.mjs` dedupes by **basename**, so a file the framework extracted
  under a new name still appears at the top of the report. Skip these — they are
  done: `ui/NamespaceGlyph.tsx` (→ `glyphs/Glyph`), `ui/GlyphGrid.tsx`
  (→ `GlyphPicker`), `ui/glyphs.ts` (→ the glyph catalogue), `ui/namespace-colors.ts`
  (→ `GLYPH_COLORS`), `ui/sideMenuPosition.ts` (→ `sidebar/position.ts`),
  `ui/namespace-favicon.ts` (→ `namespaces/favicon.ts` — basename differs, so it
  still ranks; done), `ui/hooks/useSwipeReveal.ts` (the side-menu-row sibling of
  the extracted `useRowSwipe` — left app-side, the framework's `Checklist`
  consumes `useRowSwipe` directly). Note `storage/namespaces.ts`,
  `ui/NamespacesModal.tsx`, `ui/SyncStatus.tsx`, `ui/SyncDetailsModal.tsx`, and
  `ui/SearchModal.tsx` now **dedupe out** (their basenames exist in the
  framework's `src/namespaces/`, `src/sync/`, and `src/search/`), but the app
  copies still carry the store / path-mapping / sync-engine / index glue the
  framework deliberately left behind — that residue is **not** a candidate.
  `domain/search.ts` is the inverse: it still **ranks** (its basename has no
  framework twin — the matcher landed under the new name `search/matcher.ts`) but
  it is **done** (shared matcher lifted; the index + result types are app-domain).
  When weighing "extract next", start **below** these.
- **Demo app — current scope (the integration target).** `demo/` is a
  fully-fledged local-first nested-checklist PWA in the apps' pure-black/green
  look, built end to end from the framework's own surface — the reference app
  every extraction must land in (see the demo-integration convention below).
  What it models today: a `Sidebar` shell (docked / draggable drawer) framing a
  side menu (`SideMenuContent`) of folder-grouped checklists; the list screen
  (`ChecklistScreen`) over `/checklist` + `/components`; a tabbed Settings dialog
  (`SettingsModal`, `app/settings/`) whose tabs are built from the framework's
  settings-layout primitives (`Section` / `Field` / `ToggleRow` from
  `/components`) plus an Appearance tab over `/theme` — `app/settings/shared.tsx`
  now holds only the app-glue `LanguagePicker`; an
  undo/redo document store (`useChecklistStore`, localStorage) and a seed
  (`app/seed.ts`) — driven by the side menu's Undo/Redo buttons **and** global
  keyboard chords (`useUndoRedoShortcuts` in `App.tsx`, silenced while a phone
  drawer is open); a per-list appearance feature (`/glyphs`) — each list
  carries a `glyph`+`color`, rendered in the menu and re-badging the favicon,
  edited via a header `FloatingPanel` popover (`ListAppearancePopover`); a
  Settings → General "Open the sidebar with" preference (`menuMode`) that
  toggles the phone drawer between a floating button and `useEdgeSwipeOpen`'s
  inward edge swipe (Settings is reached from the sidebar's footer, not a
  separate opener); and a Settings →
  Storage playground over the `StorageAdapter` contract whose async
  `save`/`reload` now front the framework's `CipherGlyph` busy indicator (held
  for a `BUSY_MIN_MS` anti-flicker window) — the playground also has an
  **"Encryption at rest"** section (a `ToggleRow` + passphrase) that wraps the
  localStorage adapter with the `encryption` module's `withEncryption`, a "Bytes
  on disk" panel that reveals plaintext vs the `oss.encrypted.v1` envelope JSON,
  and a "Lock (simulate reload)" + unlock prompt modelling the
  locked-after-reload lifecycle (wrong password → the framework's "Wrong
  password"), plus a **"Simulate a flaky backend"** toggle that injects transient
  save failures so the framework's `save-retry` policy (`backoffDelayMs` +
  `isRetryableSaveError` + `MAX_TRANSIENT_SAVE_RETRIES`) rides its backoff curve
  to recover ("saved after N retries"), logging each attempt under a `save`
  scope; and a list-screen **pull-to-refresh
  sync** — an inward pull from the list top re-reads the persisted document
  (`useChecklistStore.reload` behind a min-delay), surfaced by
  `PullToRefreshIndicator` (the header's write-side status now lives in the
  `SyncStatus` glyph — see the sync surface above); and a **desktop right-click context menu** on the
  list rows (`ListAppearancePopover`'s sibling `RowContextMenu`) — gated on
  `useDesktopPointer()`, wired through `Checklist`'s new `onRowContextMenu`, it
  gives a mouse the Copy text / Delete item a touch user reaches by swiping;
  and a **PWA update prompt** — `App.tsx` mounts the framework `UpdateToast`
  (and now calls `useSidebarInset` so it centres over the content band on wide
  screens), driven by a simulated "update ready" flag the **Developer tab's new
  "Software updates" section** toggles (the static demo has no service worker, so
  there is no real `usePwaUpdate` driver — the section says so), and the
  Developer "Build" block now shows the real `useStandaloneMobile()` install
  state; and an **achievements** feature (`/achievements`) — a header
  `TrophyButton` opens the four-tier `AchievementsModal` tour or, when something
  new is earned, the `AchievementUnlockModal`; a demo catalog
  (`app/achievements.ts`, 8 trophies over the checklist doc) + an app-side store
  (`app/useAchievements.ts`) drive `useAchievementWatcher`, with a first-run
  retroactive award via `deriveUnlocks` and live earns (check-all → `Clean
Sweep`, undo → manual `Time Traveler`); the Settings → General
  `disableAchievements` toggle (now on by default) gates it; and a live **i18n
  language switch** (`/i18n`) — `main.tsx` wraps `<App>` in the demo's own
  `LanguageRoot` (built from `createI18n` over `app/i18n/` en + code-split sv
  catalogs), `useT()` drives the side menu, screen header, and the whole Settings
  dialog, and the Settings → General `LanguagePicker` (now `useLang`/`setLanguage`,
  not an `AppSettings` field) flips the entire UI to Svenska instantly — the
  framework i18n runtime owns the language preference, the app owns the strings.
  And a live **multi-namespace** feature (`/namespaces`) — the side-menu header
  is now a workspace switcher (the active namespace's glyph + name; tapping it or
  the cog opens the `NamespacesModal`), seeded with two namespaces ("Privat" =
  the renamed default with the household lists, "Jobb" = a blue-briefcase empty
  workspace). An app-side `useNamespaces` store (the framework's "store stays in
  the app" seam — over the pure list helpers) holds the registry + active-slug
  pointer in two localStorage keys; `useChecklistStore` was **re-keyed by the
  active slug** (`docKey(slug)`: the default keeps the historical un-suffixed key,
  others get `:<slug>`), so switching swaps the whole document **and its undo
  history**. The gotcha that shaped it: a namespace switch must adopt the new
  doc **without** a persist-effect racing the old doc into the new key — solved
  by keeping `{ slug, data }` together in one state and **adjusting it during
  render** (React's blessed input-changed pattern) rather than in an effect. The
  tab favicon now follows the active **namespace** via `namespaceFaviconHref`
  (falling back to the active list's glyph). `AppData` lost its `namespace`
  field — the registry owns namespace identity now. And a **versioned persisted
  document** (`storage`'s `createMigrator`) — `useChecklistStore` runs the
  migrator on load and stamps `LATEST_VERSION` on write (chain in
  `app/migrations.ts`: v0→v1 bootstrap, v1→v2 lifting legacy `string[]` items into
  `ChecklistNode`s); the in-memory `AppData` stays version-free (the version lives
  only on the bytes at rest). The Settings → Developer tab gained a **"Document
  migrations"** section: it shows the current `LATEST_VERSION` and a "Load a
  legacy document" button (`store.simulateLegacyDoc()`) that writes a real
  pre-versioning file to the active doc key and re-reads it, so the runner climbs
  it v0→v2 live and logs "migrated v0 → v2" into the Logs tab (the `migrate`
  scope routes into the demo's `logStore`).
  And a **simulated sync surface** (`/sync`) — an app-side `useMockSync(store,
slug)` engine (the "store stays in the app" seam) watches the document store's
  edit counter for `dirty` and fakes a cloud round trip; the list-screen header's
  `SyncStatus` glyph morphs over its `SaveStatus` and opens the framework
  `SyncDetailsModal` command centre. Settings → Storage has a **"Where your data
  lives"** section (a `SegmentedControl` This device / Simulated cloud + an
  "Encrypt at rest" `ToggleRow`, both live), and Settings → Developer a **"Sync
  faults"** section (Go offline / Expire the session / Trigger a conflict / Rate
  limit / Clear) that injects the faults the command centre recovers from. The
  engine logs its round trip under a `sync` scope, so the modal's dev-mode log
  slot (`LogViewer`) shows real activity. The header's pull-to-refresh stays the
  read-side gesture; the glyph is the write-side status.
  And a **full-text search** (`/search`) — the side menu's search button opens
  the framework `SearchModal` over the document. The app owns the corpus
  (`app/search.ts` builds per-list groups — title + items walked recursively —
  over the framework's `compileQuery`) and the result rows (`app/SearchOverlay.tsx`
  renders each list group: `Highlighted` title + indented item rows); picking a
  result `setActive`s that list and dismisses the overlay (and the phone drawer).
  The progressive query language rides for free (substring/fuzzy/wildcard/regex);
  a 9th **"Seeker"** achievement (manual, fired from the modal's `onQueryChange`)
  was added to the demo catalog (`app/achievements.ts`).
  **Not yet modelled, so the natural next homes to widen into:** **real**
  storage backends (the sync is simulated — a genuine Dropbox/folder connect
  would seat the `storage` adapters), per-namespace **encryption** (lock one
  workspace), and **Archive**. Keep this note current as the demo grows.

## Extraction conventions

When a run actually extracts a candidate (not just reports it), follow these.
They are the accumulated "how", learned from real migrations — keep them
current as the framework grows.

### Synthesise the best component — refactor during extraction (required)

The unit of extraction is **the best possible component for a new app**, not a
copy of whichever source file scored highest. Refactoring _during_ extraction is
the point, not a detour:

- **Merge per axis, don't pick a copy.** Score each copy separately on contract
  cleanliness, capability completeness, naming, internal structure, defaults, and
  accessibility. Take the best answer on each axis from whichever copy has it. The
  output is one synthesised component — frequently a capability superset, but
  _assembled_ from the best parts, never one copy lifted because it "had more".
- **Invent past both when both are weak.** If neither copy's shape is good (a
  redundant flag, a parallel table that should be inlined, two cleanup lists that
  drift apart), design the better shape and land _that_ — even though no source
  app used it. Precedents: the achievements extraction dropped a redundant
  `hasLearnMore` flag and inlined the copy both apps kept in a parallel i18n
  table; the writer-cleanup rule replaces two parallel lists with one tracked
  source of truth. Extraction is a chance to fix the design, not freeze it.
- **Refactor freely at the seam.** Rename to neutral/general terms, split an
  over-1000-line monolith by concern (§20.5), de-duplicate helpers the apps each
  copied, hoist a shared shell (the `<Glyph>` wrapper), and invert
  container/presentational splits when props-driven is the cleaner seam (the
  `UpdateToast` inversion). All expected _during_ extraction, not follow-up work.
- **Guardrail (unchanged): synthesise the _component_, not the app.** Best-of-each
  applies to the shared, generic surface only. The store, domain types, and
  business rules still stay app-side — pulling more across the seam to "complete"
  the merge is the failure mode, not the goal.

### An extraction can enhance an existing component — it needn't be a new one

**The unit of extraction is the behaviour, not a new file.** When the best home
for the code you're mining is an **existing** framework component, hook, or
module, integrate it there — do **not** spin up a new component / hook / subpath
just because the source apps happened to keep it separate. A clean, logical
integration into a surface the framework already ships is a **first-class,
encouraged** outcome, not a lesser one — often it's the _better_ result, because
the adopter already imports the thing.

This already has precedent across the framework:

- **Behaviour folded into an existing component.** `useRowSwipe` (a standalone
  hook lift) is **consumed inside** the framework's own `Checklist` to grow an
  optional `onDelete` swipe-to-delete; `useDesktopPointer` earned its canonical
  use by **widening `Checklist`** with an optional `onRowContextMenu` prop rather
  than shipping a dead export.
- **Logic added to an existing module, no new subpath.** `createMigrator`
  (`storage/migrations.ts`) and the `save-retry` policy both landed **inside the
  existing `storage` module** — new exports on a module that already shipped, not
  new subpaths.

Decide the home by where the behaviour belongs, not by how the apps filed it:

- **Enhance an existing component / hook** when the behaviour is a capability of
  something the framework already ships (a new optional prop, an extra exported
  helper, a default the component now owns). Make it **additive and
  overridable** so existing callers see no change — the absorbed behaviour
  defaults to today's output, exactly the backward-compatible bar the `refactor`
  skill's lifts hold to.
- **Add to an existing module (no new subpath)** when the code is a sibling of
  what a module already owns — extend its barrel and `src/index.ts` only; skip
  the `tsup.config.ts` / `package.json` `exports` wiring a brand-new subpath
  needs (that's the four-place checklist below — an in-module addition touches
  just the first two).
- **Create a new component / module** only when the behaviour is genuinely its
  own concern with no existing home.

The seam rules don't change: integrating into an existing surface is **not** a
licence to drag the store, domain types, or business rules across — hold the
same generic-only boundary. And when you enhance an existing component, the demo
integration (required, below) is to **deepen that component's existing seat** in
the demo, not bolt on a new screen.

### Every component ships a usage README (required)

**Every framework component/module must have a README** at
`src/<module>/README.md`. It is the deliverable that makes the extraction
_usable_ by the new apps that will build on it.

> **READMEs are app-agnostic — always.** The framework targets green-field apps,
> not the ones an extraction happened to be sourced from. **Never name a source
> app (`notes`, `checklist`, …) in a module README.** Write in terms of "your
> app" and the framework's own symbols. Source-app provenance notes belong in
> the skill's structural notes (here), not in shipped docs. This rule holds for
> every README, present and future.

Write it as the module's own adoption guide for a **new app** building on the
framework. The audience is someone wiring this in from scratch, **not** someone
migrating a home-grown copy — so lead with how to use it well, not how to
replace something:

- **What it is / what it owns vs. what stays in the app** — be explicit about
  the seam (e.g. "the store stays in your app; the framework owns the data and
  the projection").
- **The contract** the module imposes (CSS variables written, DOM attributes,
  event shapes, file paths) so the app's other layers can line up.
- **Generic usage** — install, import, a quick-start wiring example, the full
  API surface. This is the heart of the README; make it excellent.
- **An "adapting to your app" section (required).** A new app's needs won't
  match the component exactly. Spell out the mismatches that arise and how to
  reconcile each: the app wants **fewer** slots/fields than the component
  exposes (which controls to hide, what CSS to drop); the app needs **more** /
  **extra** surface the component lacks (layer it app-side on top, or propose
  widening the framework); **renamed** variables/keys (map them in CSS or an
  adapter); **different value mappings**; **store-shape** differences. Make the
  cases concrete so an adopter recognises theirs. Do **not** frame this as
  migrating off an existing implementation — frame it as fitting a clean
  component to a new app's requirements.
- **Verification** — how to confirm the app behaves correctly after wiring.

Link the module README from the top-level `README.md` API section and add a
`CHANGELOG.md` entry, per the `AGENTS.md` documentation sync points.

### Every extraction lands in the demo app (required)

**An extraction is not done until the new surface is wired into the demo app
(`demo/`) in a natural, realistic way that makes the demo experience _better_.**
A module that ships green tests but is invisible in the running app is only half
delivered — the demo is the framework's reference app and its living proof, and
every component must earn a place in it. Shipping dead exports the demo never
exercises is the failure mode this rule exists to prevent.

The bar is **realism, not a gallery.** Do not bolt on a "component showcase"
page or a contrived widget that only exists to render the new export. Find where
the new surface belongs in the app's actual flow and put it there, so a visitor
meets it the way a real user would:

1. **Obvious home first.** If the component has a natural seat in the existing
   UI, wire it there (a row gesture into the list rows; a glyph picker into a
   list's header; a `LogViewer` into a debug surface). This is always the
   preferred outcome.
2. **No obvious home? Widen the demo to create one — don't skip the
   integration.** Grow the app's scope until the component is the logical answer
   to a real need the larger app now has. Concretely, reach for:
   - **Extend Settings.** The tabbed Settings dialog is the natural host for
     most configuration-shaped surface (toggles, pickers, segmented controls,
     appearance/theme controls, an i18n language switch). Add a tab or a section.
   - **Add profiles / accounts / workspaces.** A multi-profile or
     multi-namespace model gives storage backends, sync, encryption, per-profile
     theme/appearance, and avatars a reason to exist — and is itself a realistic
     local-first PWA feature.
   - **Add the feature the component implies.** Encryption → a "lock this
     profile" flow + an unlock prompt. A storage backend → a "where your data
     lives" picker with a real connect/disconnect. Achievements → a profile
     stats surface. i18n → a language switch that actually re-renders.
     Widening the demo is **expected and encouraged**, not scope creep: the demo
     is meant to grow into a fuller local-first app as the framework's surface
     grows, so each extraction leaves it richer and more coherent than before.
3. **Keep the seam honest.** The demo is an app, so it plays the app's role of
   the seam — it owns the store/state and passes data + labels into the
   framework component (English labels, the app's own persistence). Never reach
   past a module's public subpath export; if the demo needs something the export
   doesn't offer, that's a signal to widen the _module_, not to deep-import.
4. **Match the app's look and quality.** New demo UI must match the existing
   black/green look and the existing components' polish — it is reference code
   an adopter will copy. Wire real behaviour (undo, persistence, live updates),
   not stubs, wherever the surrounding screens already do.
5. **Verify it in the running app, not just in tests.** Build the demo
   (`npm run build --workspace demo`) and drive it (a headless Chromium
   screenshot of the new surface in use) before calling the extraction done —
   the demo must build green and the new surface must actually render and
   respond. A new subpath export also needs a `demo/vite.config.ts` alias
   (subpaths listed before the bare package so the specific match wins), or the
   demo build fails to resolve it.

When the demo gains a new screen, model, or settings area, record it in the
structural notes so the next run builds on it instead of re-discovering it.

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

- [ ] Synthesised the best component from the best of each copy for any drifted candidate — merged per axis (cleanest contract + richest capabilities), refactoring/inventing past both where neither was good — rather than lifting one copy wholesale.
- [ ] Left the app-specific store/state in the apps; moved only the shared data + pure logic.
- [ ] Wrote the module's usage README (`src/<module>/README.md`) as an adoption guide for a new app (usage + "adapting to your app"), not a per-app replacement guide.
- [ ] Wired the subpath export in all four places (barrel, root index, tsup, package.json).
- [ ] **Integrated the new surface into the demo app** in a natural, realistic way that improves the experience — wired into an existing flow, or the demo's scope widened (Settings tab, profiles, a new screen) to give it a logical home. No contrived showcase widgets.
- [ ] Added the matching `demo/vite.config.ts` alias for the new subpath, built the demo (`npm run build --workspace demo`) green, and **verified the new surface renders and responds in the running app** (headless screenshot).
- [ ] Updated top-level `README.md` API + `CHANGELOG.md`, and recorded any new demo screen / model / settings area in the structural notes.
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
