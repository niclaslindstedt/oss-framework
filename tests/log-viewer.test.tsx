// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LogViewer, createLogStore, useLogs } from "../src/logging/index.ts";

let n = 0;
function freshStore() {
  n += 1;
  const store = createLogStore({ logsKey: `test:logviewer:${n}` });
  store.setEnabled(true);
  return store;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.style.overflow = "";
});

describe("useLogs", () => {
  it("returns a stable snapshot reference between unrelated renders", () => {
    const store = freshStore();
    store.createLogger("app").info("hello");
    const { result, rerender } = renderHook(() => useLogs(store));
    const first = result.current;
    rerender();
    // A fresh `getLogs()` would hand back a new array each render and loop
    // `useSyncExternalStore`; the hook must cache it.
    expect(result.current).toBe(first);
    expect(first.map((e) => e.message)).toEqual(["hello"]);
  });

  it("re-renders with the new buffer when the store changes", () => {
    const store = freshStore();
    const log = store.createLogger("app");
    const { result } = renderHook(() => useLogs(store));
    expect(result.current).toHaveLength(0);
    act(() => log.info("after mount"));
    expect(result.current.map((e) => e.message)).toEqual(["after mount"]);
  });
});

describe("LogViewer", () => {
  it("renders entries with their level and scope, and clears them", () => {
    const store = freshStore();
    const log = store.createLogger("dropbox");
    log.info("list_folder → 200");

    render(<LogViewer store={store} />);
    expect(screen.getByText("list_folder → 200")).toBeTruthy();
    expect(screen.getByText("INFO")).toBeTruthy();
    expect(screen.getByText("[dropbox]")).toBeTruthy();
    expect(screen.getByText("1 entry.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("list_folder → 200")).toBeNull();
    expect(screen.getByText("No log lines yet.")).toBeTruthy();
  });
});
