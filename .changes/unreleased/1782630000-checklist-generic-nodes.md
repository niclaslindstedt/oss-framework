---
type: Changed
title: Generic checklist nodes, caller-named swipe-commit, and isHidden
---

`checklist`: the tree helpers are generic over the app's node type, so fields an app intersects onto `ChecklistNode` (notes, a template id, an "archived"/"shelved" flag) round-trip through every transform with their types intact — `removeNode(items, id)` over an `Item[]` returns `Item[]`, and the new `updateNode` export is the generic per-node edit primitive an app drives its own field updates with. `Checklist` gains a caller-named `swipeAction` (a right-swipe commit whose `label` / `icon` the app supplies — the framework names nothing) and an `isHidden` predicate that drops a node and its subtree from the rendered rows and `countProgress`, so an app's archive/snooze policy stays the app's concern rather than a built-in flag.
