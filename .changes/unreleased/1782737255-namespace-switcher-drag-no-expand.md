---
type: Removed
title: NamespaceSwitcher drag-expand
breaking: true
---

`namespaces`: `NamespaceSwitcher` no longer force-expands while a drag is in flight — a collapsed switcher now stays collapsed, leaving the user the room to drop into a folder, and only the namespaces already on screen are cross-namespace drop targets. The now-unused `dragging` prop is removed.
