// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  canRedo,
  canUndo,
  clearTimeline,
  committed,
  redone,
  undone,
  type Timeline,
} from "../src/history/timeline.ts";

/** A rung that is more than the document — the case the module exists for. */
type Rung = { text: string; caret: number };

const rung = (text: string, caret = 0): Rung => ({ text, caret });

describe("clearTimeline", () => {
  it("has nothing behind and nothing ahead", () => {
    const t = clearTimeline<Rung>();
    expect(t).toEqual({ past: [], future: [] });
    expect(canUndo(t)).toBe(false);
    expect(canRedo(t)).toBe(false);
  });
});

describe("committed", () => {
  it("puts the present behind us", () => {
    const t = committed(clearTimeline<Rung>(), rung("a"));
    expect(t.past).toEqual([rung("a")]);
    expect(canUndo(t)).toBe(true);
  });

  it("forfeits the future", () => {
    let t: Timeline<Rung> = { past: [rung("a")], future: [rung("c")] };
    t = committed(t, rung("b"));
    expect(t.future).toEqual([]);
    expect(canRedo(t)).toBe(false);
  });

  it("leaves the timeline it was given alone", () => {
    const t = clearTimeline<Rung>();
    committed(t, rung("a"));
    expect(t.past).toEqual([]);
  });

  it("drops the oldest rungs past a limit", () => {
    let t = clearTimeline<Rung>();
    for (const text of ["a", "b", "c", "d", "e"]) {
      t = committed(t, rung(text), 3);
    }
    expect(t.past.map((r) => r.text)).toEqual(["c", "d", "e"]);
  });

  it("is unbounded without one", () => {
    let t = clearTimeline<Rung>();
    for (let i = 0; i < 200; i += 1) t = committed(t, rung(String(i)));
    expect(t.past).toHaveLength(200);
  });
});

describe("undone / redone", () => {
  it("says nothing when there is nothing behind or ahead", () => {
    expect(undone(clearTimeline<Rung>(), rung("a"))).toBeNull();
    expect(redone(clearTimeline<Rung>(), rung("a"))).toBeNull();
  });

  it("steps back onto the last rung and puts the present on the future", () => {
    const t = committed(clearTimeline<Rung>(), rung("a"));
    const step = undone(t, rung("b"))!;
    expect(step.present).toEqual(rung("a"));
    expect(step.timeline).toEqual({ past: [], future: [rung("b")] });
  });

  it("steps forward again onto exactly what was stepped back from", () => {
    const one = committed(clearTimeline<Rung>(), rung("a"));
    const back = undone(one, rung("b"))!;
    const forward = redone(back.timeline, back.present)!;
    expect(forward.present).toEqual(rung("b"));
    expect(forward.timeline).toEqual(one);
  });

  it("walks a whole run back and forward again", () => {
    let t = clearTimeline<Rung>();
    let present = rung("a");
    for (const text of ["b", "c", "d"]) {
      t = committed(t, present);
      present = rung(text);
    }
    const seen: string[] = [];
    for (;;) {
      const step = undone(t, present);
      if (!step) break;
      t = step.timeline;
      present = step.present;
      seen.push(present.text);
    }
    expect(seen).toEqual(["c", "b", "a"]);
    const ahead: string[] = [];
    for (;;) {
      const step = redone(t, present);
      if (!step) break;
      t = step.timeline;
      present = step.present;
      ahead.push(present.text);
    }
    expect(ahead).toEqual(["b", "c", "d"]);
    expect(present).toEqual(rung("d"));
  });

  it("restores what is not in the document but is something you did", () => {
    // The caret is not part of the text, and stepping back has to put it back.
    const t = committed(clearTimeline<Rung>(), rung("hello", 5));
    const step = undone(t, rung("hello world", 11))!;
    expect(step.present.caret).toBe(5);
  });

  it("shares its rungs rather than copying them", () => {
    const first = rung("a");
    const t = committed(clearTimeline<Rung>(), first);
    expect(undone(t, rung("b"))!.present).toBe(first);
  });

  it("carries a rung whose value is falsy", () => {
    const t = committed<string>(clearTimeline<string>(), "");
    const step = undone(t, "x")!;
    expect(step.present).toBe("");
  });
});
