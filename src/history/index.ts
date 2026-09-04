// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public history surface — the two stacks behind Cmd/Ctrl+Z. `timeline.ts` is
// the pure, immutable arithmetic, generic in what a rung holds (which is
// usually more than the document: a selection, a cursor, whatever the user
// *did* that a step back has to put back). `useHistory` wraps it as a piece of
// React state for the ordinary case where the undoable value is not in a store
// of its own. The keyboard half is `useUndoRedoShortcuts` in `hooks/`.
export {
  clearTimeline,
  committed,
  undone,
  redone,
  canUndo,
  canRedo,
  type Timeline,
  type Stepped,
} from "./timeline.ts";
export { useHistory, type History, type HistoryOptions } from "./useHistory.ts";
