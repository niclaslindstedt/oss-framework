---
type: Added
title: Checklist module
---

A `checklist` module: the nested checkable list both apps grew — `Checklist` renders depth-indented items with child checklists, cascade-on-check, collapse, sink-checked ordering, and drag grips; `ChecklistProgress` is the header ring badge with a bulk check/uncheck menu; and `tree.ts` is the pure, DOM-free core (`toggleNode`, `setAllChecked`, `countProgress`, `sortCheckedToBottom`, …) an app can drive its own store with.
