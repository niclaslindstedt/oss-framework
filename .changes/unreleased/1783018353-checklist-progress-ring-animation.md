---
type: Changed
title: Animated progress ring
---

`ChecklistProgress` now eases its ring arc between values instead of snapping
it: checking an item sweeps the circle glyph round to the new fraction (and
animates the accent→success recolour at 100%) rather than blipping straight to
it. The `data-reduce-motion` theme rule collapses the transition to an instant
jump for users who ask for less motion.
