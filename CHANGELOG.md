# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial framework scaffold: tsup build (ESM + CJS + types), Vitest, ESLint,
  Prettier, and the Makefile developer entry points.
- `useEscapeKey` hook — the first shared piece extracted from the `notes` and
  `checklist` apps (it was already byte-identical in both).
- `find-refactor-candidates` agent skill: clones both source apps via the
  GitLab mirror and ranks shared files by cross-app similarity.
- Project governance docs and `OSS_SPEC.md` as the standing ruleset.
