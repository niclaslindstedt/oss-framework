---
type: Changed
title: Row gestures split cleanly by pointer
---

`components` / `checklist` / `hooks`: swipe and long-press are now touch-only affordances, and the right-click menu is desktop-only — `SwipeableRow`, the `Checklist`'s swipe-to-delete, and `RowActionMenu` read the pointer (`useDesktopPointer`) so a mouse never drags a row open or holds to a menu, a phone never pops the browser's native context menu, and each device gets exactly one way in (right-click on desktop, swipe + long press on touch). `useRowSwipe` gains an `enabled` option to gate the gesture off directly.
