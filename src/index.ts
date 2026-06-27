// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OSS Framework — shared React building blocks for local-first PWAs.
//
// The framework is seeded from functionality that already exists, in
// near-duplicate form, in the `notes` and `checklist` apps: storage
// backends, encryption, themes, folders and namespaces. Code is migrated
// here deliberately, one cohesive unit at a time; run the
// find-refactor-candidates skill to see what is ready to move next.
//
// Module map (folders fill in as code is migrated):
//   hooks/      — framework-agnostic React hooks (the first to land)
//   storage/    — the StorageAdapter contract and its backends
//   theme/      — theme vocabulary, palettes, and the projection engine
//   logging/    — in-app log buffer + capture mirror for the storage sink
//   sidebar/    — responsive navigation shell (docked / drawer framing)
//   components/ — shared UI primitives (modal, buttons, inputs, dropdown, glyphs)
//   checklist/  — nested checkable list (items, child checklists, progress)
//   glyphs/     — glyph + accent-colour picker kit (icon catalogue, pickers)
//   pwa/        — service-worker update lifecycle + install-context detection
//   achievements/ — gamification engine (derive/watcher/bus) + trophy UI
//   encryption/ — at-rest crypto and the encrypt/decrypt migration queue
//   i18n/       — typed, dependency-free `t()` runtime (the createI18n factory)
//   namespaces/ — named buckets (profiles/workspaces) + favicon + management UI
//   sync/       — header status glyph + command-centre modal over a sync engine
//   search/     — progressive-query matcher + highlighting + generic SearchModal

export * from "./hooks/index.ts";
export * from "./theme/index.ts";
export * from "./changelog/index.ts";
export * from "./storage/index.ts";
export * from "./logging/index.ts";
export * from "./sidebar/index.ts";
export * from "./components/index.ts";
export * from "./checklist/index.ts";
export * from "./glyphs/index.ts";
export * from "./pwa/index.ts";
export * from "./achievements/index.ts";
export * from "./encryption/index.ts";
export * from "./i18n/index.ts";
export * from "./namespaces/index.ts";
export * from "./sync/index.ts";
export * from "./search/index.ts";
