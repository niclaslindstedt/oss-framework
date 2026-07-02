---
type: Added
title: useLocalStorageState
---

New `useLocalStorageState` hook — `useState` that survives a reload, owning
the safe parse, stored-partial-over-defaults merge, and write-through
persistence every app previously hand-rolled per slice; `parse`/`serialize`
are overridable for non-JSON payloads.
