---
type: Added
title: Inline edit row
---

`components`: an `InlineEditRow` — the in-place text editor a list swaps in to rename or create an item. It owns the parts every inline editor wires the same way and is easy to get subtly wrong: focus-and-select on mount, Enter/blur-commits-(trimmed)-Escape-cancels semantics, and the `committed` latch that stops a post-Enter blur from firing the callback twice. The row's layout, leading slot, and icon stay injectable props; it takes and returns a plain string, never a domain entity.
