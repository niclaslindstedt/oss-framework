---
type: Fixed
title: Drop the soft keyboard when the drawer opens
---

`sidebar`: opening the drawer (the non-pinned, phone variant) now blurs any focused editable element, so the soft keyboard it raised slides away instead of covering the drawer that just slid in. Most visible when the drawer is opened mid-type via an inward edge swipe, which never moves focus the way a button tap does; a keyboard user on the toggle keeps their focus.
