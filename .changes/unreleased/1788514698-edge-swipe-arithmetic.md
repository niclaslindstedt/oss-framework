---
type: Added
title: Edge-swipe arithmetic
---

`inEdgeZone` and `classifyEdgeDrag` expose the drawer's open-swipe rule, so a
canvas or map that handles its own pointer stream can share it instead of
copying the two thresholds into its own file.
