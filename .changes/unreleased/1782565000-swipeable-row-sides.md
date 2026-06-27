---
type: Changed
title: Configurable SwipeableRow sides
---

`components`: `SwipeableRow` is now symmetric and fully configurable. Each side is driven independently with `leading` (right) / `trailing` (left), and each is either a `reveal` (a latched strip of buttons) or a `commit` (a flick-to-act with a labelled backdrop) — so a row can delete-by-flick one way and reveal a strip the other, not just the fixed left-reveal / right-archive. Reveal buttons (`SwipeActionButton`) and the commit backdrop take optional `background` / `color` classes and glyph/label overrides. The old `actions` / `onArchive` / `archiveLabel` / `archiveIcon` props still work as sugar over the two sides. `hooks`: `useRowSwipe` gains `leading` / `trailing` side options (`RowSwipeSide`) and an `openSide` in its return, so either direction can latch a reveal or fire a commit.
