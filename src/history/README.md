<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `history` — the two stacks behind Cmd/Ctrl+Z

```ts
const history = useHistory(doc);

history.set(next); // leaves a rung
history.undo();
history.canRedo;
```

For an app with a real document store, skip the hook: keep one `Timeline` in a
ref and drive `committed` / `undone` / `redone` yourself. They are pure and
immutable, so a whole undo run can be walked in a node test with no store, no
React and no DOM.

## A rung is a value, and it is more than the document

Rungs are **shared, never copied**. With an immutable document the state before
an edit already shares almost everything with the state after it, so a deep
stack costs far less than it looks like it should — and "keep the value" is
exact, where a diff is only as exact as its author. An app whose document is
mutable or genuinely large is the one that should reach for a diff scheme
instead.

The rung type is the caller's because a rung is **what a step has to put back**,
and that is usually more than the document: a selection, a cursor, which pane
was open. That is the part a per-app undo stack gets wrong. A drawing app is the
case that proves it — a selection window is never saved and never synced, but
building one up stroke by stroke and then losing it to an unrelated undo is a
trap, so the window rides the same timeline as the marks:

```ts
type Rung = { doc: Drawing; selection: Selection | null };
```

## Gestures

`replace` changes the value without leaving a rung; `commit(before)` puts one
down. A slider dragged across its track is one edit to undo, not two hundred.

The keyboard half is `useUndoRedoShortcuts` in `hooks/`.
