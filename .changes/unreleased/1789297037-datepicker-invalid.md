---
type: Added
title: DatePicker error state
---

`DatePicker` takes an `invalid` prop, painting `aria-invalid` and a danger
border on its trigger the way `LabeledInput` does — so a validating form can
use it in place of a native `<input type="date">`, whose iOS wheel closes on a
month commit and whose intrinsic width overflows a narrow card.
