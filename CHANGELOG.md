# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial framework scaffold: tsup build (ESM + CJS + types), Vitest, ESLint,
  Prettier, and the Makefile developer entry points.
- `release` workflow: publishes to the GitHub Packages npm registry on a `v*`
  tag using the built-in `GITHUB_TOKEN` (no long-lived credential), gated on the
  build/test/lint suite, and attaches a GitHub Release.
- `useEscapeKey` hook — the first shared piece extracted from the `notes` and
  `checklist` apps (it was already byte-identical in both).
- `theme` module (`@niclaslindstedt/oss-framework/theme`) — the shared theme
  engine and theme data: the preset vocabulary, the per-preset palettes, the
  `CustomTheme` shape with `customThemeSeed` / `coerceCustomTheme`, the webfont
  loaders, and the `useApplyTheme` projection. Heals the drift between the two
  apps' near-duplicate copies by converging both onto one canonical 18-slot
  vocabulary. Ships with a migration README
  ([`src/theme/README.md`](src/theme/README.md)).
- `find-refactor-candidates` agent skill: clones both source apps via the
  GitLab mirror and ranks shared files by cross-app similarity.
- Project governance docs and `OSS_SPEC.md` as the standing ruleset.
