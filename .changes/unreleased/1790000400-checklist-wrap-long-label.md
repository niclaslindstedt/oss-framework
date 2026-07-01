---
type: Fixed
title: Long checklist labels wrap instead of clipping
---

A `Checklist` row whose label is too long for one line now wraps onto the next instead of being clipped with an ellipsis. Both the editable and read-only label render as `break-words`, so a long unbroken run (a URL or word) splits rather than overflowing the row and shoving the trailing grips off-screen.
