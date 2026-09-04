// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What an undo steps back through.
//
// The arithmetic of the two stacks behind Cmd/Ctrl+Z, and nothing else: pure,
// immutable, and generic in what a rung actually holds — so the whole of undo
// and redo can be driven in a test with no store, no React and no DOM. The
// keyboard half is `useUndoRedoShortcuts`; the state half is here.
//
// **A rung is a value, not a diff.** Every verb below answers with a new
// timeline rather than pushing and popping in place. Rungs themselves are
// shared, never copied — with an immutable document, the state before an edit
// already shares almost everything with the state after it, so a deep stack of
// them costs far less than it looks like it should. An app whose document is
// mutable, or genuinely large, is the one that should reach for a diff scheme
// instead; for everything else "keep the value" is exact where a diff is only
// as exact as its author.
//
// **A rung is what a step has to put back — which is usually more than the
// document.** That is why the rung type is the caller's. The thing this gets
// wrong when it is written per-app is the state that is *not* in the document
// but *is* something the user did: a selection, a cursor, which pane was open.
// A drawing app is the case that proves it — a selection window is never saved
// and never synced, but building one up and then losing it to an unrelated
// undo is a trap, so the window rides the same timeline as the marks and
// Cmd/Ctrl+Z steps back through whichever of them last changed, the way it
// does in every program that has both.

/** What is behind the present, and what stepping back has taken off it. */
export interface Timeline<T> {
  past: readonly T[];
  future: readonly T[];
}

/** A timeline with nothing on it — a document just loaded, a workspace just
 *  opened. Nothing to step back to, and nothing the last step took off. */
export function clearTimeline<T>(): Timeline<T> {
  return { past: [], future: [] };
}

/** Whether there is anything to step back to. */
export function canUndo<T>(timeline: Timeline<T>): boolean {
  return timeline.past.length > 0;
}

/** Whether anything was stepped back through. */
export function canRedo<T>(timeline: Timeline<T>): boolean {
  return timeline.future.length > 0;
}

/** Put `present` behind us, making room for whatever the caller is about to
 *  make the present instead.
 *
 *  A new rung forfeits the future, which is what every undo stack anyone has
 *  used does: step back three times, do something else, and the three you
 *  stepped back through are gone rather than waiting to be redone into the
 *  middle of an edit they never followed.
 *
 *  `limit` caps how deep the past goes, dropping the oldest rungs — for an app
 *  whose rungs are big enough to be worth bounding. Omit it and the past is
 *  unbounded, which is the right default when a rung is a shared immutable
 *  value. */
export function committed<T>(
  timeline: Timeline<T>,
  present: T,
  limit?: number,
): Timeline<T> {
  const past = [...timeline.past, present];
  return {
    past: limit !== undefined && limit >= 0 ? past.slice(-limit) : past,
    future: [],
  };
}

/** Where a step lands: the timeline as it now stands, and the rung that should
 *  become the present. */
export interface Stepped<T> {
  timeline: Timeline<T>;
  present: T;
}

/** Step back, or `null` when there is nothing behind us. */
export function undone<T>(
  timeline: Timeline<T>,
  present: T,
): Stepped<T> | null {
  const previous = timeline.past.at(-1);
  if (previous === undefined) return null;
  return {
    timeline: {
      past: timeline.past.slice(0, -1),
      future: [...timeline.future, present],
    },
    present: previous,
  };
}

/** Step forward again, or `null` when nothing was stepped back through. */
export function redone<T>(
  timeline: Timeline<T>,
  present: T,
): Stepped<T> | null {
  const next = timeline.future.at(-1);
  if (next === undefined) return null;
  return {
    timeline: {
      past: [...timeline.past, present],
      future: timeline.future.slice(0, -1),
    },
    present: next,
  };
}
