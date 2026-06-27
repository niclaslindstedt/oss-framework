---
type: Changed
title: useUndoRedoShortcuts gates itself while a modal is open
---

`useUndoRedoShortcuts` now stands down on its own while any `[aria-modal="true"]` element is mounted (every framework dialog carries it), so a global Cmd/Ctrl+Z can't reach through an open modal to the document behind it — opt out with the new `gateWhileModalOpen: false`.
