// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useDesktopPointer,
  useMediaQuery,
} from "../src/hooks/useMediaQuery.ts";

// A controllable `MediaQueryList` stand-in: jsdom ships no `matchMedia`, so we
// install a fake keyed by query string whose `matches` we can flip and whose
// `change` listeners we can fire — exactly the surface the hook subscribes to.
type FakeMql = {
  query: string;
  matches: boolean;
  listeners: Set<() => void>;
};

const registry = new Map<string, FakeMql>();

function fakeMatchMedia(query: string): MediaQueryList {
  let mql = registry.get(query);
  if (!mql) {
    mql = { query, matches: false, listeners: new Set() };
    registry.set(query, mql);
  }
  const entry = mql;
  return {
    // Live getter — the real `MediaQueryList.matches` reflects the current
    // state, so a flip after the hook captured the list is still observed.
    get matches() {
      return entry.matches;
    },
    media: query,
    addEventListener: (_: string, cb: () => void) => entry.listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) =>
      entry.listeners.delete(cb),
  } as unknown as MediaQueryList;
}

function setMatches(query: string, matches: boolean) {
  const mql = registry.get(query);
  if (!mql) return;
  mql.matches = matches;
  act(() => {
    for (const cb of mql.listeners) cb();
  });
}

beforeEach(() => {
  registry.clear();
  vi.stubGlobal("matchMedia", fakeMatchMedia);
  window.matchMedia = fakeMatchMedia as typeof window.matchMedia;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("reads the initial match synchronously", () => {
    registry.set("(min-width: 768px)", {
      query: "(min-width: 768px)",
      matches: true,
      listeners: new Set(),
    });
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("re-renders when the query flips", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    setMatches("(min-width: 768px)", true);
    expect(result.current).toBe(true);
    setMatches("(min-width: 768px)", false);
    expect(result.current).toBe(false);
  });

  it("detaches its listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    const mql = registry.get("(min-width: 768px)");
    expect(mql?.listeners.size).toBe(1);
    unmount();
    expect(mql?.listeners.size).toBe(0);
  });

  it("reports false when matchMedia is unavailable", () => {
    // @ts-expect-error — simulate an environment without matchMedia.
    window.matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
  });
});

describe("useDesktopPointer", () => {
  it("tracks the precise-hovering-pointer query", () => {
    const { result } = renderHook(() => useDesktopPointer());
    expect(result.current).toBe(false);
    setMatches("(hover: hover) and (pointer: fine)", true);
    expect(result.current).toBe(true);
  });
});
