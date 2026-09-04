---
type: Added
title: Viewport report and shell-scroll pin
---

`pwa` gains `readSafeAreaInsets` / `readViewportReport` / `resolveCssLength`, so
a safe-area layout report carries the numbers rather than a guess, and
`useShellScrollPin`, which puts a one-viewport-tall shell back after iOS's
software keyboard has scrolled it away.
