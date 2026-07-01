---
type: Fixed
title: Ordered lists renumber; a lone hyphen is a divider
---

Ordered lists in the `/markdown` preview now renumber sequentially from their first item's value, so `1.` / `1.` renders as 1, 2 instead of 1, 1 (nested levels step through lower-alpha and lower-roman off the same running count). A line that is just a single `-` now renders as a thematic-break divider — tinted like the quote bar — alongside the usual `---`; a `- ` with text after it is still a bullet. Each ordered `LineBlock` carries the computed number as `seq`.
