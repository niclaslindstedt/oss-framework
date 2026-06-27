---
type: Added
title: Row action menu + long-press hook
---

`components`: a `RowActionMenu` — a row's secondary-action menu summoned without a dedicated button, opened by a desktop right-click or a touch long press over the wrapped row and rendered through `FloatingPanel` (anchored, portalled, Escape/outside-click to close). `hooks`: a `useLongPress` gesture hook — fire a callback when a pointer is held in place past a delay, cancelling on a drag and swallowing the trailing tap so the press never doubles as the row's normal activation.
