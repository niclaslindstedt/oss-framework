---
type: Added
title: Depth-aware list markers in the Markdown preview
---

The `/markdown` live preview now styles list markers by nesting depth: bullets step `•` → `◦` → `▪` and ordered items step decimal → lower-alpha → lower-roman (`1.` → `a.` → `i.`, keeping the source's `.`/`)` separator), with nested items indented and the top-level bullet enlarged for legibility. Each list `LineBlock` gains a `depth` field (one level per two columns of indent, a tab counting as two) for apps rendering their own preview over `classifyLines`.
