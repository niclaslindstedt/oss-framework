---
type: Added
title: Drag-and-drop hook for navigation rows
---

A `useDragDrop` hook in the `sidebar` module — a headless, pointer-driven (touch + mouse + pen) drag-and-drop primitive that tracks the gesture and hit-tests registered drop zones, leaving the payloads, the legality rules (`canDrop`), and the drop outcome (`onDrop`) to the host. The demo wires it into the side menu so a checklist drags into a folder, out to the root, onto another namespace, or onto Archive, and a folder drags across namespaces or to Archive.
