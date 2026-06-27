// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  usePersistentMenuPosition,
  type MenuButtonPosition,
} from "../src/sidebar/index.ts";

const KEY = "test:menu-position";

afterEach(() => {
  localStorage.clear();
});

describe("usePersistentMenuPosition", () => {
  it("defaults to the left edge when nothing is stored", () => {
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    expect(result.current[0]).toEqual({ side: "left", y: 0.5 });
  });

  it("honours a supplied initial position", () => {
    const initial: MenuButtonPosition = { side: "right", y: 0.2 };
    const { result } = renderHook(() =>
      usePersistentMenuPosition(KEY, initial),
    );
    expect(result.current[0]).toEqual(initial);
  });

  it("persists a new position to localStorage", () => {
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    act(() => result.current[1]({ side: "right", y: 0.75 }));

    expect(result.current[0]).toEqual({ side: "right", y: 0.75 });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      side: "right",
      y: 0.75,
    });
  });

  it("hydrates the stored position on mount", () => {
    localStorage.setItem(KEY, JSON.stringify({ side: "right", y: 0.9 }));
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    expect(result.current[0]).toEqual({ side: "right", y: 0.9 });
  });

  it("clamps a stored out-of-range vertical fraction", () => {
    localStorage.setItem(KEY, JSON.stringify({ side: "left", y: 5 }));
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    expect(result.current[0]).toEqual({ side: "left", y: 1 });
  });

  it("falls back to the default for a malformed stored value", () => {
    localStorage.setItem(KEY, "{not json");
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    expect(result.current[0]).toEqual({ side: "left", y: 0.5 });
  });

  it("ignores a stored value of the wrong shape", () => {
    localStorage.setItem(KEY, JSON.stringify({ side: "up", y: "x" }));
    const { result } = renderHook(() => usePersistentMenuPosition(KEY));
    expect(result.current[0]).toEqual({ side: "left", y: 0.5 });
  });
});
