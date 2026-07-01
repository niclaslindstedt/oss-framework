---
type: Added
title: ContextMenu
---

New `ContextMenu` component renders a keyboard-navigable action menu anchored
at the cursor of a caught `contextmenu` event, owning the portal, outside-click
dismissal, Escape, and viewport clamping; `FloatingPanel` and
`useFloatingPosition` now accept a point anchor (`anchorPoint` / a `{ x, y }`
argument) alongside a trigger ref.
