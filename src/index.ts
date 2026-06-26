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
//   encryption/ — at-rest crypto and the encrypt/decrypt migration queue

export * from "./hooks/index.ts";
export * from "./theme/index.ts";
export * from "./changelog/index.ts";
export * from "./storage/index.ts";
