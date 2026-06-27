---
type: Added
title: Edit and reorder checklist rows
doc: checklist
---

`checklist`: `Checklist` rows can now be edited and reordered in place. With `editable`, tapping a row's text swaps it for an inline field (focus + select, Enter/blur commits, Escape cancels); with `reorderable`, a long press (touch) or a grip press lifts a row to drag and drop it before/after another — reparenting into the target's sibling list, so a row can move between child checklists. Both flow back through the same `onChange` a toggle commits through, and the pure tree helpers `renameNode` / `moveNode` back them for store-driven apps.
