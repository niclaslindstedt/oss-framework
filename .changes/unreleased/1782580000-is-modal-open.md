---
type: Added
title: Shared modal gate
---

`hooks`: `isModalOpen()` — `true` while any framework dialog (`[aria-modal="true"]`) is mounted, the shared gate `usePullToRefresh`, `useEdgeSwipeOpen`, and `useUndoRedoShortcuts` already use to stand down while a dialog owns the screen, now exported so your own document-level gestures can gate the same way.
