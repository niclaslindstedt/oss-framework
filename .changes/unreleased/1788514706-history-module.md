---
type: Added
title: Undo timeline
---

The new `history` module is the state half of Cmd/Ctrl+Z: pure, immutable
stacks generic in what a rung holds — which is usually more than the document —
plus a `useHistory` hook whose `replace`/`commit` pair makes a whole drag one
step back.
