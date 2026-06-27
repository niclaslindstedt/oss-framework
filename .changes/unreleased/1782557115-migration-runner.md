---
type: Added
title: Document-migration runner
---

`storage` gains `createMigrator` — a forward-only runner that upgrades a persisted document to the latest version on load (coercing pre-versioning and corrupt headers to v0, throwing on a newer-than-build document or a gap in the chain); the migration chain and latest version stay your app's data, the engine is shared.
