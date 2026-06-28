---
type: Changed
title: Configurable SwipeableRow sides
---

`components`: `SwipeableRow` is now symmetric and fully configurable. Each side is driven independently with `leading` (right) / `trailing` (left), and each is either a `reveal` (a latched strip of buttons) or a `commit` (a flick-to-act with a labelled backdrop) — so a row can delete-by-flick one way and reveal a strip the other, not just a fixed left-reveal / right-commit. Reveal buttons (`SwipeActionButton`) and the commit backdrop take optional `background` / `color` classes and glyph/label overrides. `actions` remains as sugar for a `trailing` reveal; a commit side always names itself — the framework ships no default caption or glyph, so the caller supplies the backdrop's `label` / `icon`. `hooks`: `useRowSwipe` gains `leading` / `trailing` side options (`RowSwipeSide`) and an `openSide` in its return, so either direction can latch a reveal or fire a commit.
