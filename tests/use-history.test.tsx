// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useHistory } from "../src/history/useHistory.ts";

describe("useHistory", () => {
  it("starts on its initial value with nowhere to step", () => {
    const { result } = renderHook(() => useHistory("a"));
    expect(result.current.value).toBe("a");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("takes a lazy initial value", () => {
    const { result } = renderHook(() => useHistory(() => "lazy"));
    expect(result.current.value).toBe("lazy");
  });

  it("steps back and forward through what `set` left behind", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.set("c"));
    expect(result.current.value).toBe("c");

    act(() => result.current.undo());
    expect(result.current.value).toBe("b");
    act(() => result.current.undo());
    expect(result.current.value).toBe("a");
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.value).toBe("b");
    act(() => result.current.redo());
    expect(result.current.value).toBe("c");
    expect(result.current.canRedo).toBe(false);
  });

  it("takes an updater, like useState's setter", () => {
    const { result } = renderHook(() => useHistory(1));
    act(() => result.current.set((n) => n + 1));
    act(() => result.current.set((n) => n + 1));
    expect(result.current.value).toBe(3);
    act(() => result.current.undo());
    expect(result.current.value).toBe(2);
  });

  it("leaves no rung for a set that changes nothing", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("a"));
    expect(result.current.canUndo).toBe(false);
  });

  it("forfeits the future once something else is done", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.set("c"));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.value).toBe("a");
  });

  it("makes a whole gesture one step back", () => {
    const { result } = renderHook(() => useHistory(0));
    const before = result.current.value;
    // The frames of a drag: no rung each.
    act(() => result.current.replace(10));
    act(() => result.current.replace(20));
    act(() => result.current.replace(30));
    expect(result.current.canUndo).toBe(false);
    // …and one at the end of it.
    act(() => result.current.commit(before));
    act(() => result.current.undo());
    expect(result.current.value).toBe(0);
    act(() => result.current.redo());
    expect(result.current.value).toBe(30);
  });

  it("does nothing when there is nothing to step to", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.value).toBe("a");
  });

  it("caps the past at a limit", () => {
    const { result } = renderHook(() => useHistory("a", { limit: 2 }));
    act(() => result.current.set("b"));
    act(() => result.current.set("c"));
    act(() => result.current.set("d"));
    expect(result.current.timeline.past).toEqual(["b", "c"]);
    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(result.current.value).toBe("b");
    expect(result.current.canUndo).toBe(false);
  });

  it("forgets where it has been on reset, keeping the value", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.reset());
    expect(result.current.value).toBe("b");
    expect(result.current.canUndo).toBe(false);
  });

  it("takes a new value on reset — a different document", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.reset("elsewhere"));
    expect(result.current.value).toBe("elsewhere");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("keeps its callbacks stable across edits", () => {
    const { result } = renderHook(() => useHistory("a"));
    const { set, undo, redo, replace, commit, reset } = result.current;
    act(() => result.current.set("b"));
    expect(result.current.set).toBe(set);
    expect(result.current.undo).toBe(undo);
    expect(result.current.redo).toBe(redo);
    expect(result.current.replace).toBe(replace);
    expect(result.current.commit).toBe(commit);
    expect(result.current.reset).toBe(reset);
  });
});
