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

// The rendered messages, top to bottom — the panel's entry order.
function messages(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(".whitespace-pre-wrap"),
    (el) => el.textContent ?? "",
  );
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

  it("shows the newest entry first by default", () => {
    const store = freshStore();
    const log = store.createLogger("sync");
    log.info("first");
    log.info("second");
    log.info("third");

    const { container } = render(<LogViewer store={store} />);
    expect(messages(container)).toEqual(["third", "second", "first"]);
  });

  it("keeps the store's buffer order when asked for oldest-first", () => {
    const store = freshStore();
    const log = store.createLogger("sync");
    log.info("first");
    log.info("second");

    const { container } = render(
      <LogViewer store={store} order="oldest-first" />,
    );
    expect(messages(container)).toEqual(["first", "second"]);
  });

  it("orders by a caller-supplied comparator", () => {
    const store = freshStore();
    store.createLogger("b").info("from b");
    store.createLogger("a").info("from a");

    const { container } = render(
      <LogViewer
        store={store}
        order={(x, y) => x.scope.localeCompare(y.scope)}
      />,
    );
    expect(messages(container)).toEqual(["from a", "from b"]);
  });

  it("copies the lines in the order shown", async () => {
    const store = freshStore();
    const log = store.createLogger("sync");
    log.info("first");
    log.info("second");

    const written: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: (t: string) => {
          written.push(t);
          return Promise.resolve();
        },
      },
    });

    render(<LogViewer store={store} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });

    const lines = written[0]?.split("\n") ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("second");
    expect(lines[1]).toContain("first");
  });
});
