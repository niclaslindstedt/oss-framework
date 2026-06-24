# Contributing

Thanks for helping build the OSS Framework. This document is the contract
between the project and contributors (OSS_SPEC §4).

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm 10+

## Getting the source

```bash
git clone https://github.com/niclaslindstedt/oss-framework.git
cd oss-framework
npm install
```

## Build, test, lint

Use the Makefile targets — CI runs the same ones:

```bash
make build      # bundle the library
make test       # run the Vitest suite
make lint       # eslint + tsc --noEmit (zero warnings)
make fmt        # format in place
make fmt-check  # verify formatting
```

## Development workflow

1. Fork and branch: `feat/<slug>` or `fix/<slug>`.
2. Make your change with a test alongside it.
3. Run `make lint && make test` before pushing.
4. Open a PR; its title must be a valid conventional-commit subject.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) (OSS_SPEC §8.1):

```
feat(hooks): add useMediaQuery
fix(storage): handle missing revision token
```

Allowed types: `feat`, `fix`, `perf`, `docs`, `test`, `refactor`, `chore`.

## Testing expectations

- Tests live in `tests/`, named `<subject>.test.ts` (OSS_SPEC §20).
- New behavior ships with a test. Bug fixes ship with a regression test.
- Source files stay under 1000 physical lines (OSS_SPEC §20.5).

## Documentation expectations

When you change the public API, update the README API table, `CHANGELOG.md`,
and — if you add a subpath export — `package.json` `exports` and
`tsup.config.ts`. See the sync table in [`AGENTS.md`](AGENTS.md).

When extracting shared code from the source apps, follow the
`find-refactor-candidates` skill and keep its structural notes current.

## Pull request process

PRs are squash-merged after review. The squash commit is the PR title, so keep
it a clean conventional-commit subject.

## Code of conduct & security

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). Report
vulnerabilities via the process in [SECURITY.md](SECURITY.md), not public
issues.
