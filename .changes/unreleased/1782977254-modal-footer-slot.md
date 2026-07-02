---
type: Added
title: Modal footer slot
---

`Modal` accepts an optional `footer` slot for a bottom button bar. Passed here
instead of as the last child, the Modal pins it below the scrolling content and
owns the iOS-PWA home-indicator clearance beneath it — a bottom safe-area
spacer mirroring the top-inset spacer it already renders above the header — so
a footer never hand-computes `calc(… + env(safe-area-inset-bottom))`. Existing
modals (no `footer`) render unchanged.
