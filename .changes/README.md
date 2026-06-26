<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Changeset fragments

`CHANGELOG.md` is **generated at release time**, not hand-edited. Every PR that
changes the published `src/` surface adds a small fragment here describing the
user-facing change; the `release` workflow consumes every fragment into a new
dated `CHANGELOG.md` section and derives the semver bump from them.

This is the same mechanism the framework's own
[`changelog`](../src/changelog/README.md) component renders — the framework
dogfoods it.

## Adding a fragment

Create one file per user-facing change under `unreleased/`:

```
.changes/unreleased/<unix-ts>-short-slug.md
```

```markdown
---
type: Added # Added | Changed | Fixed | Removed | Security | Deprecated
title: Short title # optional — bolded at the head of the bullet
doc: theming # optional — links to docs/features/<doc>.md ("Learn more")
breaking: true # optional — forces a major bump
---

One-sentence, user-facing summary. Keep it to a sentence; long-form
explanation belongs in a feature doc, not the changelog.
```

The `<unix-ts>-` prefix (`date +%s`) gives a deterministic sort that loosely
tracks commit order. Validation lives in
[`scripts/release/fragments.mjs`](../scripts/release/fragments.mjs); a malformed
fragment fails the build loudly.

## How the bump is derived

The release takes the **highest** level any fragment implies:

| Signal                                         | Bump  |
| ---------------------------------------------- | ----- |
| `breaking: true` (any type)                    | major |
| `Added` / `Changed` / `Removed` / `Deprecated` | minor |
| `Fixed` / `Security`                           | patch |

A genuinely breaking removal is `type: Removed` **plus** `breaking: true`.

## Opting out

A PR with no user-visible impact (pure refactor, CI/build tweak, docs, lockfile
bump) needs no fragment — the skip-list in
[`scripts/release/check-changeset.mjs`](../scripts/release/check-changeset.mjs)
passes it. If the gate still fires on a genuinely invisible change, apply the
`no-changelog` label to the PR.

## Cutting a release

Run the **release** workflow (manual dispatch). With `bump: auto` (the default)
it computes the bump from the fragments here, collates them into `CHANGELOG.md`,
bumps `package.json`, tags `vX.Y.Z`, publishes to GitHub Packages, and creates a
GitHub Release whose body is the new section. Override `bump` only to force a
specific level.

> The `[Unreleased]` prose currently in `CHANGELOG.md` predates this system. At
> the first fragment-driven release, fold it into the generated section (or
> leave it under `[Unreleased]`) — afterwards, all entries flow through
> fragments and `[Unreleased]` stays a bare stub.
