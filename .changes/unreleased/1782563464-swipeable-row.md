---
type: Added
title: Swipeable list rows
---

`components`: a `SwipeableRow` — swipe a row left to latch a strip of icon actions open (rename, delete, …), swipe it right past the threshold to archive — that owns the strip markup, the reveal masking, the slide-off timing, and the `select-none` / touch-callout and `data-drawer-swipe-ignore` tags a mobile gesture needs, so an adopter only declares its `RowAction`s and an `onArchive`. `RowActionMenu` now disables text selection and the iOS touch-callout under a long press. `hooks`: `useRowSwipe`'s `onDismiss` is optional — omit it and a right swipe simply snaps back, for a row that offers the left reveal alone.
