// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createToastStore } from "../src/components/toast.ts";
import { ToastViewport } from "../src/components/ToastViewport.tsx";

// The viewport's exit transition holds a dismissed toast in the DOM briefly
// before it leaves the store; with fake timers, flushing everything pending
// runs both the countdown and that exit hand-off.
function flushTimers() {
  act(() => {
    vi.runAllTimers();
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createToastStore", () => {
  it("pushes with defaults filled in and returns the id", () => {
    const store = createToastStore({ defaultDurationMs: 1234 });
    const id = store.push({ message: "Saved" });

    const toasts = store.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      id,
      message: "Saved",
      kind: "info",
      durationMs: 1234,
    });
  });

  it("caps the stack by dropping the oldest", () => {
    const store = createToastStore({ maxToasts: 3 });
    store.push({ message: "one" });
    store.push({ message: "two" });
    store.push({ message: "three" });
    store.push({ message: "four" });

    expect(store.getToasts().map((t) => t.message)).toEqual([
      "two",
      "three",
      "four",
    ]);
  });

  it("dismisses by id and notifies subscribers", () => {
    const store = createToastStore();
    const seen = vi.fn();
    const unsubscribe = store.subscribe(seen);

    const id = store.push({ message: "gone soon" });
    store.push({ message: "stays" });
    store.dismiss(id);

    expect(store.getToasts().map((t) => t.message)).toEqual(["stays"]);
    expect(seen).toHaveBeenCalledTimes(3);

    unsubscribe();
    store.dismiss("toast-nope"); // unknown id: no-op, no notify
    store.clear();
    expect(store.getToasts()).toEqual([]);
    expect(seen).toHaveBeenCalledTimes(3);
  });
});

describe("ToastViewport", () => {
  it("renders a pushed toast as a polite status", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Copied to clipboard" });
    });

    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("Copied to clipboard");
    expect(toast.parentElement?.getAttribute("aria-live")).toBe("polite");
  });

  it("uses role=alert for danger toasts", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Sync failed", kind: "danger", durationMs: 0 });
    });

    expect(screen.getByRole("alert").textContent).toContain("Sync failed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("auto-dismisses after durationMs", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Ephemeral", durationMs: 3000 });
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByRole("status")).not.toBeNull();

    flushTimers();
    expect(screen.queryByRole("status")).toBeNull();
    expect(store.getToasts()).toEqual([]);
  });

  it("keeps a zero-duration toast until dismissed by hand", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Sticky", durationMs: 0 });
    });

    flushTimers();
    expect(screen.getByRole("status").textContent).toContain("Sticky");
  });

  it("pauses the countdown on hover and resumes with the remaining time", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Hover me", durationMs: 1000 });
    });
    const toast = screen.getByRole("status");

    // Burn 600ms, then hover: the remaining 400ms must not elapse while held.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.mouseOver(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("status")).not.toBeNull();

    // Leave: only the leftover 400ms remains on the clock.
    fireEvent.mouseOut(toast);
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByRole("status")).not.toBeNull();

    flushTimers();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("pauses the countdown while focus is inside the toast", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "Focus me", durationMs: 1000 });
    });

    act(() => {
      screen.getByRole("button", { name: "Dismiss" }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("status")).not.toBeNull();

    act(() => {
      screen.getByRole("button", { name: "Dismiss" }).blur();
    });
    flushTimers();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("drops the oldest toast beyond the cap", () => {
    vi.useFakeTimers();
    const store = createToastStore({ maxToasts: 2 });
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({ message: "first", durationMs: 0 });
      store.push({ message: "second", durationMs: 0 });
      store.push({ message: "third", durationMs: 0 });
    });

    const messages = screen
      .getAllByRole("status")
      .map((el) => el.textContent ?? "");
    expect(messages.some((m) => m.includes("first"))).toBe(false);
    expect(messages.some((m) => m.includes("second"))).toBe(true);
    expect(messages.some((m) => m.includes("third"))).toBe(true);
  });

  it("fires the action and dismisses the toast", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const onAction = vi.fn();
    render(<ToastViewport store={store} />);

    act(() => {
      store.push({
        message: "Row removed",
        durationMs: 0,
        action: { label: "Undo", onAction },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);

    flushTimers();
    expect(screen.queryByRole("status")).toBeNull();
    expect(store.getToasts()).toEqual([]);
  });

  it("dismisses via the dismiss button, whose label is injectable", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastViewport store={store} labels={{ dismiss: "Stäng" }} />);

    act(() => {
      store.push({ message: "Close me", durationMs: 0 });
    });

    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    flushTimers();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
