// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLocalStorageState } from "../src/hooks/index.ts";

const KEY = "test:slice";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useLocalStorageState", () => {
  it("boots from the defaults and writes them through", () => {
    const { result } = renderHook(() =>
      useLocalStorageState(KEY, { a: 1, b: "x" }),
    );

    expect(result.current[0]).toEqual({ a: 1, b: "x" });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ a: 1, b: "x" });
  });

  it("merges a stored partial over object defaults", () => {
    // A previous app version persisted only `a`; the new version adds `b`.
    localStorage.setItem(KEY, JSON.stringify({ a: 42 }));
    const { result } = renderHook(() =>
      useLocalStorageState(KEY, { a: 1, b: "x" }),
    );

    expect(result.current[0]).toEqual({ a: 42, b: "x" });
  });

  it("passes non-object values through without merging", () => {
    localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useLocalStorageState(KEY, [0]));
    expect(result.current[0]).toEqual([1, 2, 3]);

    localStorage.setItem(KEY, JSON.stringify(7));
    const { result: num } = renderHook(() => useLocalStorageState(KEY, 0));
    expect(num.current[0]).toBe(7);
  });

  it("falls back to the defaults on a corrupt payload", () => {
    localStorage.setItem(KEY, "{not json");
    const { result } = renderHook(() => useLocalStorageState(KEY, { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it("persists updates, including functional ones", () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, { n: 0 }));

    act(() => result.current[1]({ n: 5 }));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ n: 5 });

    act(() => result.current[1]((prev) => ({ n: prev.n + 1 })));
    expect(result.current[0]).toEqual({ n: 6 });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ n: 6 });
  });

  it("survives a remount with the persisted value", () => {
    const first = renderHook(() => useLocalStorageState(KEY, { n: 0 }));
    act(() => first.result.current[1]({ n: 9 }));
    first.unmount();

    const second = renderHook(() => useLocalStorageState(KEY, { n: 0 }));
    expect(second.result.current[0]).toEqual({ n: 9 });
  });

  it("supports custom parse/serialize for non-JSON payloads", () => {
    // A raw string slice — stored verbatim, not JSON-quoted.
    localStorage.setItem(KEY, "work");
    const { result } = renderHook(() =>
      useLocalStorageState(KEY, "default", {
        parse: (raw) => raw,
        serialize: (v) => v,
      }),
    );

    expect(result.current[0]).toBe("work");
    act(() => result.current[1]("travel"));
    expect(localStorage.getItem(KEY)).toBe("travel");
  });

  it("falls back to defaults when a custom parse throws", () => {
    localStorage.setItem(KEY, "garbage");
    const { result } = renderHook(() =>
      useLocalStorageState(KEY, "default", {
        parse: () => {
          throw new Error("invalid");
        },
      }),
    );
    expect(result.current[0]).toBe("default");
  });

  it("keeps working in memory when the write is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => useLocalStorageState(KEY, { n: 0 }));
    act(() => result.current[1]({ n: 3 }));

    expect(result.current[0]).toEqual({ n: 3 });
  });
});
