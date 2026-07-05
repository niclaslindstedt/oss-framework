---
type: Added
title: Modal backdrop appearance
---

Two new global `UiStyle` axes — `backdropDarkness` and `backdropBlur` — let an
app tune how the page behind an open dialog is dimmed and blurred; the engine
projects them as `--modal-backdrop-darkness` / `--modal-backdrop-blur`, with
defaults matching the original 50% black, no-blur scrim.
