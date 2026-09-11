---
type: Added
title: ActionMenuList is public
---

The action menu's body — the keyboard-navigable `role="menu"` that `RowActionMenu` and `ContextMenu` share — is now exported in its own right, so an app whose menu opens on an ordinary press (a header button offering a choice of formats, say) can drop it into a `FloatingPanel` of its own instead of re-implementing the list, the arrow keys and the row tinting.
