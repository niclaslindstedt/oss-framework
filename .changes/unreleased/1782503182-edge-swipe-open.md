---
type: Added
title: Open the drawer with an edge swipe
---

`sidebar`: a `useEdgeSwipeOpen` hook — the counterpart to `useDrawerSwipeClose`. A touch that starts at the drawer's resting edge and travels inward opens it, so an app that hides the floating menu button (a "swipe to open" preference, a phone-only PWA) still has a way in. It is touch-only, stands down while a modal is open, ignores a mostly-vertical drag, and takes optional `edgeZone` / `openDistance` thresholds.
