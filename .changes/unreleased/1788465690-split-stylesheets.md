---
type: Added
title: Per-theme stylesheets
---

`styles/base.css` plus `styles/theme/<id>.css` let an app import only the
themes it offers instead of all thirteen (14.3 kB → 9.7 kB for two), and
`installPresetTokens(["nord"])` does the same for the runtime path.
