---
type: Added
title: Labeled fields
---

`LabeledInput` and `LabeledTextarea` stack a caption over a bordered field
that holds its draft locally and commits on blur (or Enter), so a settled
edit reaches the store as one undoable step; the shared look is exported as
`LABELED_FIELD_CLASS`.
