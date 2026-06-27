---
type: Added
title: Inline edit field
---

`components`: an `InlineEditField` — the bare focus-and-select-on-mount, Enter/blur-commits-Escape-cancels `<input>` at the heart of `InlineEditRow`, extracted so it can be dropped wherever a label sits (a checklist row's label slot) without the row chrome. `InlineEditRow` now builds on it; `INLINE_EDIT_FIELD_CLASS` is the shared default field styling.
