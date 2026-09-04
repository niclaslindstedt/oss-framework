// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useMemo, useRef, useState } from "react";

import {
  canRedo,
  canUndo,
  clearTimeline,
  committed,
  redone,
  undone,
  type Timeline,
} from "./timeline.ts";

// The timeline as a piece of React state — a `useState` that remembers where
// it has been.
//
// It is deliberately *not* a store: the value it holds is whatever the caller
// puts in it, and an app with a real document store keeps the document there
// and reaches for `timeline.ts` directly (the store then owns one `Timeline`
// in a ref and does as it is told). This is for the ordinary case — a screen,
// a form, a canvas of its own — where the undoable value is a piece of state
// and the only thing missing is the two stacks around it.
//
// The distinction that matters is between **setting** and **committing**.
// `set` replaces the value and puts the old one behind you; `replace` changes
// it without leaving a rung, which is what a drag in flight wants — a slider
// pulled across its track is one edit to undo, not two hundred.

export interface History<T> {
  /** The value now. */
  value: T;
  /** Replace the value, leaving the old one on the timeline. Takes the next
   *  value or an updater, like `useState`'s setter. */
  set: (next: T | ((current: T) => T)) => void;
  /** Replace the value without leaving a rung — for the frames of a gesture
   *  that is one edit. End the gesture with `set` (or `commit`). */
  replace: (next: T | ((current: T) => T)) => void;
  /** Put the current value on the timeline without changing it — for a caller
   *  that has already written through `replace` and now wants that whole run
   *  to be one step back. */
  commit: (before: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Forget everything behind and ahead, keeping the value — what loading a
   *  different document should do. */
  reset: (next?: T) => void;
  timeline: Timeline<T>;
}

export interface HistoryOptions {
  /** Cap on how deep the past goes. Unbounded by default. */
  limit?: number;
}

export function useHistory<T>(
  initial: T | (() => T),
  { limit }: HistoryOptions = {},
): History<T> {
  const [value, setValue] = useState(initial);
  const [timeline, setTimeline] = useState<Timeline<T>>(clearTimeline<T>);
  // The live value, so the callbacks below can be stable across renders — a
  // memoized child taking `undo` should not be invalidated by every edit.
  const latest = useRef(value);
  latest.current = value;

  const resolve = useCallback(
    (next: T | ((current: T) => T)): T =>
      typeof next === "function"
        ? (next as (current: T) => T)(latest.current)
        : next,
    [],
  );

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const before = latest.current;
      const after = resolve(next);
      if (Object.is(after, before)) return;
      setTimeline((t) => committed(t, before, limit));
      setValue(after);
    },
    [limit, resolve],
  );

  const replace = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue(resolve(next));
    },
    [resolve],
  );

  const commit = useCallback(
    (before: T) => {
      setTimeline((t) => committed(t, before, limit));
    },
    [limit],
  );

  const undo = useCallback(() => {
    setTimeline((t) => {
      const stepped = undone(t, latest.current);
      if (!stepped) return t;
      setValue(stepped.present);
      return stepped.timeline;
    });
  }, []);

  const redo = useCallback(() => {
    setTimeline((t) => {
      const stepped = redone(t, latest.current);
      if (!stepped) return t;
      setValue(stepped.present);
      return stepped.timeline;
    });
  }, []);

  const reset = useCallback((next?: T) => {
    setTimeline(clearTimeline<T>());
    if (next !== undefined) setValue(next);
  }, []);

  return useMemo(
    () => ({
      value,
      set,
      replace,
      commit,
      undo,
      redo,
      canUndo: canUndo(timeline),
      canRedo: canRedo(timeline),
      reset,
      timeline,
    }),
    [value, timeline, set, replace, commit, undo, redo, reset],
  );
}
