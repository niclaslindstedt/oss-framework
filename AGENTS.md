# Agent guidance — OSS Framework

This is the single source of truth for AI coding agents working in this
repository (OSS_SPEC §7). Tool-specific files (`CLAUDE.md`, …) are symlinks to
this file — never edit them directly.

## What this project is

`@niclaslindstedt/oss-framework` is an npm package of React components, hooks,
and utilities for building local-first PWAs. It is seeded from functionality
that exists today as near-duplicate copies inside two apps —
[`notes`](https://github.com/niclaslindstedt/notes) and
[`checklist`](https://github.com/niclaslindstedt/checklist): storage backends,
encryption, themes, folders, namespaces, achievements, i18n, and
swipe/gesture hooks. The goal is to extract that shared surface here so both
apps depend on one implementation instead of hand-copying changes between
each other.

## Build / test / lint commands

Use the Makefile targets (OSS_SPEC §9); CI invokes the same ones.

| Command          | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `make build`     | Bundle the library with tsup (ESM + CJS + d.ts)               |
| `make test`      | Run the Vitest suite                                          |
| `make lint`      | ESLint + `tsc --noEmit` (library **and** demo), zero warnings |
| `make fmt`       | Format in place with Prettier                                 |
| `make fmt-check` | Verify formatting without writing                             |
| `make clean`     | Remove `dist/`                                                |

`npm run <script>` works for every target too (see `package.json`). `make lint`
type-checks the `demo/` workspace as well as the library (`npm run typecheck
--workspace demo`) — the demo is built by Vite, not `tsc`, so without this its
types would drift unchecked.

### No errors get through

This codebase ships clean. **Any error a command surfaces is yours to fix before
you finish — no matter who introduced it.** A pre-existing failure is not
someone else's problem to route around; treat "it was already broken" as a bug
to close, not an excuse to leave it. Concretely:

- Never land work while `make lint`, `make test`, `make build`, or `make
fmt-check` is red. If a check you didn't touch is failing, fix it (or, if it's
  genuinely out of scope, say so explicitly rather than ignoring it).
- When you run a check that isn't yet in the gate (e.g. you type-check a
  workspace by hand) and it surfaces errors, fix them **and** wire that check
  into the gate so they can't come back. Errors you can see but the gate can't
  are the ones that rot.
- "Not my errors" is not a reason to skip them. The bar is a clean tree, not a
  clean diff.

## Commit and PR conventions

- **Conventional Commits** (OSS_SPEC §8.1): `feat`, `fix`, `perf`, `docs`,
  `test`, `refactor`, `chore`. Scope is the module, e.g. `feat(hooks): …`.
- Branch names: `feat/<slug>`, `fix/<slug>`.
- PRs are squash-merged; the PR title must itself be a conventional-commit
  subject (it becomes the squash commit).

### Watching a PR after you open it

This environment delivers PR lifecycle events — **merge, close, and CI
failures** — as `<github-webhook-activity>` messages that wake the session.
So once a PR is open and its CI checks are green:

- **Do not** set up a recurring `CronCreate` (or `send_later`) self check-in to
  poll the PR, and **do not** manually re-poll CI status "to be sure". Both are
  wasted motion here — the webhook will wake you on a failure or the merge.
- After confirming CI is green, **end the turn**. Act only when a webhook event
  arrives (fix a reported CI failure, reply to a review comment); on the merged
  event, stop — the work is done.
- The generic harness advice to "schedule an hourly check-in because webhooks
  miss merge transitions" does **not** apply to this repo: merges _are_
  delivered (you'll get a "PR has been merged" event). Ignore that fallback.

## Architecture and dependency direction

```
src/
├── index.ts        barrel — re-exports the public surface
├── hooks/          framework-agnostic React hooks (first to land)
├── storage/        the StorageAdapter contract and its backends
├── theme/          appearance store + theme projection engine
├── changelog/      "What's new" dialog over a Keep-a-Changelog CHANGELOG.md
└── encryption/     at-rest crypto + encrypt/decrypt migration queue
```

- `react` / `react-dom` are **peer** dependencies — never bundle them, never
  add a second copy. Keep runtime deps minimal; prefer zero.
- Code flows one way: leaf modules (`hooks`) must not import from feature
  modules (`storage`, `theme`). Shared types live next to their contract.
- **No domain / business naming in `src/`.** The framework names the *mechanism*,
  never an app's *use* of it. A specific app's vocabulary — `archive`, `note`,
  `budget`, `transaction`, `recipe`, … — must not appear in a published API:
  not in a prop (`onArchive`), a type field (`archived`), a function
  (`setNodeArchived`), an exported name, a default string (`label = "Archive"`),
  or a comment that frames a generic part as that feature. Name the capability
  for what it *does*: a row flick-off is a `commit` action the caller labels; a
  node that drops out of a view is driven by a caller-supplied predicate
  (`isHidden`), not a built-in `archived` flag. The litmus test: could a second,
  unrelated app reuse this without inheriting the first app's concept? If the
  name only makes sense for one app, it's domain logic — it belongs to the
  adopter, not here. **Only `demo/` (and downstream apps) may carry such names**;
  the demo is where "archive" lives, layered on the framework's generic seam via
  its own types, strings, and store. This is the same seam the `refactor` skill
  guards: lift generic responsibility *in*, never drag the store, domain types,
  business rules, or their **names** across it.
- Every public entry point is wired in `src/index.ts` (and, for a subpath
  export, in `tsup.config.ts` + the `exports` map in `package.json`).
- `demo/` is a Vite app (an npm workspace) that previews the components,
  building against `src/` via aliases so a deploy reflects the live commit. It
  is **not** published surface; `pages.yml` deploys it to GitHub Pages at `/`
  (release), `/preview/` (main), and `/branch/` (a dispatched branch). See
  [`demo/README.md`](demo/README.md).

## Where new code goes

| Change type                      | Goes in                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| A new shared hook                | `src/hooks/` + re-export in `src/hooks/index.ts`                            |
| A storage backend / adapter type | `src/storage/`                                                              |
| Theme / appearance logic         | `src/theme/`                                                                |
| Changelog / "What's new" UI      | `src/changelog/`                                                            |
| Encryption / migration logic     | `src/encryption/`                                                           |
| A test                           | `tests/<name>.test.ts` (see below)                                          |
| A new public subpath export      | `src/<mod>/index.ts` + `tsup.config.ts` + `package.json` `exports`          |
| A user-facing change (changelog) | a `.changes/unreleased/` fragment (see "Cutting a release")                 |
| Showing off a component          | wire it into the reference app under `demo/src/app/` (see `demo/README.md`) |

When extracting from the source apps, follow the `find-refactor-candidates`
skill — it ranks what to pull next and how to treat each tier.

## Test conventions (OSS_SPEC §20)

- Tests live in `tests/`, **separate** from source, named `<subject>.test.ts`.
- Run with `make test` (Vitest, jsdom environment, globals enabled).
- Source files must stay under **1000 physical lines** (§20.5). When
  extracting a large app file (e.g. `useStorageBackend.ts`, ~2000 lines),
  split it by concern as part of the migration — do not lift the monolith.

## Cutting a release

Releases run on **changeset fragments**, not hand-edited changelog entries — the
framework dogfoods its own `changelog` module end to end (fragments → collated
`CHANGELOG.md` → the `ChangelogModal` an app renders it through).

- **Every PR touching the published `src/` surface drops a fragment** under
  `.changes/unreleased/` describing the user-facing change. CI's `changeset` job
  enforces it; pure refactors / CI / docs pass via the skip-list, or label the
  PR `no-changelog`. Fragment format and the bump policy live in
  [`.changes/README.md`](.changes/README.md) and
  [`scripts/release/`](scripts/release).
- **The bump is automatic.** `breaking: true` → major; `Added`/`Changed`/
  `Removed`/`Deprecated` → minor; `Fixed`/`Security` → patch. The release takes
  the highest level across all fragments.
- **Releasing** is a manual dispatch of the `release` workflow with `bump: auto`
  (the default). It derives the bump, collates the fragments into a dated
  `CHANGELOG.md` section, bumps `package.json`, tags `vX.Y.Z`, publishes to the
  GitHub Packages registry, and cuts a GitHub Release. Override `bump` only to
  force a level.
- **Locally:** `make bump` prints the implied bump; `make changelog
VERSION=X.Y.Z` previews the collated section without releasing.

## Documentation sync points

| If you change …                         | Also update …                                           |
| --------------------------------------- | ------------------------------------------------------- |
| The public API (`src/index.ts` exports) | `README.md` Usage/API section + a `.changes/` fragment  |
| A subpath export                        | `package.json` `exports`, `tsup.config.ts`              |
| The source-app layout assumptions       | `find-refactor-candidates` SKILL.md structural notes    |
| Anything user-facing                    | a `.changes/unreleased/` fragment (collated at release) |

`CHANGELOG.md` itself is **generated** from the fragments — do not hand-edit it
for a normal change; add a fragment instead (see below).

## Maintenance skills (OSS_SPEC §21)

Agent skills live in `.agent/skills/<name>/SKILL.md`; `.claude/skills` is a
symlink to `.agent/skills`. Shipped today:

| Skill                      | When to run                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find-refactor-candidates` | Deciding what shared code to extract from `notes`/`checklist` into the framework next. Clones both apps (via the `MIRROR_*` env vars) and ranks files by cross-app similarity.                                                                                                                                                               |
| `refactor`                 | Improving the components already extracted. Works a roadmap (`docs/refactoring-roadmap.md`) of components extracted _too lightly_ — lifting generic, non-domain responsibility (UI plumbing, defaults, accessibility, gesture-to-markup) off the adopter and into the component, without dragging the store or domain types across the seam. |
| `adopt-app`                | Bootstrapping a **new consumer app** from the framework — scaffold a Vite + Tailwind project, install the package, lift the demo's app skeleton (`demo/src/app/`), and mutate it into a new domain. The adopter counterpart to the two maintainer skills (it never edits `src/`); grounded in the demo's seam manifest (`demo/ADOPTION.md`). |

The per-artifact maintenance skills required by §21.5 (`update-readme`,
`update-docs`, the `maintenance` umbrella, `sync-oss-spec`) are **not yet
present** — add them as the framework grows the artifacts they keep in sync.

## Local environment & debugging

Notes on this execution environment — the gotchas that cost time if you don't
know them up front:

- **Dependencies are not pre-installed.** A fresh container has no
  `node_modules`, so `make lint` / `make test` / `make build` fail with
  `ERR_MODULE_NOT_FOUND` (e.g. `@eslint/js`) until you install. Run `npm
install` first; it installs the workspaces (the `demo/`) too. In CI this is
  `npm ci`.
- **The demo is a workspace.** Type-check it with `npm run typecheck --workspace
demo` and build it with `npm run build:demo` (or `make`-equivalent scripts).
  Its `tsconfig` resolves the framework against `../src` via path aliases and
  pulls the framework's ambient `*.d.ts` into its program, so it type-checks the
  source it imports — keep those ambient decls (`src/**/*.d.ts`) resolvable from
  the demo program when you touch them.
- **Playwright is installed globally, not in the project.** It lives at
  `/opt/node22/lib/node_modules`, so a project script can't `import "playwright"`
  directly. `NODE_PATH` does **not** help an ESM (`.mjs`) script — Node ignores
  it for `import`. Resolve it by absolute path instead:
  ```js
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  ```
- **Chromium is pre-installed; do not run `playwright install`.** Launch it with
  an explicit `executablePath: "/opt/pw-browsers/chromium"`
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is already set).
- **To verify a demo change in a real browser**, start the dev server
  (`npm run dev --workspace demo`, serves on `http://localhost:5173/`) and drive
  it with a Playwright script — don't `sleep`-poll a built `site/` directory.
- **Bash shell state doesn't persist** between tool calls and `cd` can trip a
  permission prompt; prefer absolute paths or a single compound command.

## Governing spec

[`OSS_SPEC.md`](./OSS_SPEC.md) is the project's standing ruleset. Not every
section applies to a library: the CLI requirements (§12), `man/` pages,
website-as-product deployment (§11.4–11.5), and `examples/`/`prompts/`
directories are out of scope unless and until the framework grows that
surface. The hygiene, AGENTS.md, commit, testing, file-size, and agent-skill
rules all apply.
