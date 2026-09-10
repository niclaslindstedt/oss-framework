---
type: Fixed
title: Dropdowns stop at the screen's reserved edges
---

Floating panels are now placed inside the visible band minus the device's safe-area insets, so a menu that flips above its trigger no longer runs under an iOS status bar or home indicator; an app can reserve its own pinned chrome by marking it `data-floating-edge="top"` (or `"bottom"`), and `placement.edges` opts a single panel out.
