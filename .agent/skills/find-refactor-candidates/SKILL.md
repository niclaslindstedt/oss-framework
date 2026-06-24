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

| Signal                                                                           | Interpretation                       | Action                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| ≥ 95% similar, self-contained (a hook, a glyph, an encoder)                      | Shared verbatim, trivial deps        | Extract first. Lift the file, generalize names, add a test, re-export.                          |
| 80–95% similar                                                                   | Shared logic with app-specific drift | Extract the common core; thread the differences through props / params / a small config object. |
| High-similarity **module** (whole `storage/`, `theme/`, `achievements/` cluster) | A subsystem duplicated wholesale     | Plan a module-level migration; don't cherry-pick files that import each other.                  |
| < 80% similar                                                                    | Genuinely diverged or app-specific   | Leave in the apps for now; revisit after the cheap wins land.                                   |
| Any file > 1000 lines (⚠️ in the report)                                         | Violates OSS_SPEC §20.5              | Split by concern _as part of_ extraction — do not import the monolith.                          |
| Names baked in (`Note`, `checklist`)                                             | App-domain coupling                  | Parameterize or generalize the type before it enters the public API.                            |

Known structural notes about the source apps (keep current):

- `storage/adapter.ts` is the central `StorageAdapter` contract every backend
  (`local`, `folder`, `dropbox`, `gdrive`) implements — the natural seam for
  the framework's storage surface.
- `theme/useTheme.ts` is the appearance store + projection engine; the notes
  copy is already annotated "Ported from checklist's useTheme".
- `storage/useStorageBackend.ts` is the largest shared file (~2000 lines) and
  blows the §20.5 limit — it must be decomposed during extraction, not lifted.
- `i18n/locales/**` similarity is low by design (translations differ); the
  i18n _machinery_ (`i18n/index.ts`, `locale.ts`) is the real candidate.

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

This skill's value is in its accumulated judgment, not its scripts. At the end
of every run, fold back what you learned:

- Add or refine rows in the **Candidate → action mapping** table when a tier or
  module turned out to behave differently than the table predicted.
- Update the **structural notes** when the apps' layout changes (a file split,
  a module renamed, a new backend added).
- If the similarity heuristic mis-ranked something (scored two files as similar
  that a diff showed are not, or vice versa), note it and adjust the metric in
  `scripts/similarity.mjs`.
- Commit these SKILL.md edits alongside whatever extraction or report the run
  produced — an un-updated skill rots the same way the duplication it hunts
  does.
