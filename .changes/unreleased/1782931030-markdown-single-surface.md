---
type: Changed
title: MarkdownEditor rebuilt on one contenteditable surface
breaking: true
---

The `/markdown` live-preview editor now renders on a single `contenteditable` surface instead of a per-line roaming `<textarea>`: the browser owns native caret glide across wrapped lines, whole-document `Ctrl/Cmd+A`, and cross-line touch selection on mobile, while every edit is intercepted at `beforeinput` and applied to the source through a new pure line-edit engine (`replaceRange`, exported alongside `orderPoints`/`pointsEqual`) so the source string stays the single source of truth. Copy **and cut** now put the verbatim Markdown — leading `#`/`-`/`>` block markers included — on the clipboard, a tapped line scrolls clear of the soft keyboard, and selected text tints with the active theme. **Breaking:** `extractSourceRange(lines, blocks, a, b)` drops its `blocks` argument — it is now `extractSourceRange(lines, a, b)` and returns verbatim source (markers included); `snapStartToLineEdge` is exported for callers that need the old marker-trimming boundary behaviour.
