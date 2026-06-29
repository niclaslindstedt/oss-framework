---
type: Changed
title: Drag nav rows by the whole row, not a grip
---

`useDragDrop` (in `/sidebar`) now makes the whole row the drag source instead of a dedicated grip column: a mouse press-and-drags, while a finger presses-and-holds to pick the row up (`longPressMs`, default 400ms) so a quick touch still scrolls or swipes the row. `RowActionMenu` gains a `touchLongPress` prop to hand its hold over to such a gesture, opening on a desktop right-click only.
