// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePullToRefresh } from "../src/hooks/usePullToRefresh.ts";
import { PullToRefreshIndicator } from "../src/components/PullToRefreshIndicator.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

// Mirror the hook's live state onto data-attributes so the test can read what
// the gesture produced. The hook listens at the document level.
function Harness({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const { state, pullDistance } = usePullToRefresh(onRefresh);
  return (
    <div data-testid="probe" data-state={state} data-pull={pullDistance}>
      probe
    </div>
  );
}

// jsdom can't construct TouchEvent, so build the event ourselves and attach a
// minimal `touches` list the hook reads (`length`, `[0].clientY`). The state
// updates the hook fires must flush inside `act`.
function dispatchTouch(
  type: "touchstart" | "touchmove" | "touchend",
  y: number | null,
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", {
    value: y === null ? [] : [{ clientY: y }],
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(ev);
  });
}

describe("usePullToRefresh", () => {
  it("arms past the trigger distance and fires onRefresh on release", async () => {
    let resolve!: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    render(<Harness onRefresh={onRefresh} />);
    const probe = screen.getByTestId("probe");

    dispatchTouch("touchstart", 10);
    // Raw 200px down → damped 100px (RESISTANCE 0.5), past the 70px trigger.
    dispatchTouch("touchmove", 210);
    expect(probe.getAttribute("data-state")).toBe("release");
    expect(Number(probe.getAttribute("data-pull"))).toBe(100);

    dispatchTouch("touchend", null);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // Pinned at the trigger distance while the refresh promise is in flight.
    expect(probe.getAttribute("data-state")).toBe("refreshing");
    expect(Number(probe.getAttribute("data-pull"))).toBe(70);

    await act(async () => {
      resolve();
    });
    await waitFor(() => expect(probe.getAttribute("data-state")).toBe("idle"));
    expect(Number(probe.getAttribute("data-pull"))).toBe(0);
  });

  it("cancels without refreshing when the pull falls short", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const probe = screen.getByTestId("probe");

    dispatchTouch("touchstart", 10);
    // Raw 80px → damped 40px, short of the 70px trigger.
    dispatchTouch("touchmove", 90);
    expect(probe.getAttribute("data-state")).toBe("pulling");

    dispatchTouch("touchend", null);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(probe.getAttribute("data-state")).toBe("idle");
  });

  it("ignores an upward drag (normal scrolling)", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const probe = screen.getByTestId("probe");

    dispatchTouch("touchstart", 100);
    dispatchTouch("touchmove", 60); // upward
    expect(probe.getAttribute("data-state")).toBe("idle");
    dispatchTouch("touchend", null);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("stands down while a modal is open", () => {
    const onRefresh = vi.fn();
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    render(<Harness onRefresh={onRefresh} />);
    const probe = screen.getByTestId("probe");

    dispatchTouch("touchstart", 10);
    dispatchTouch("touchmove", 210);
    // touchstart never armed (startY stayed null), so nothing happens.
    expect(probe.getAttribute("data-state")).toBe("idle");
    dispatchTouch("touchend", null);
    expect(onRefresh).not.toHaveBeenCalled();

    document.body.removeChild(modal);
  });
});

describe("PullToRefreshIndicator", () => {
  it("renders nothing at rest", () => {
    const { container } = render(
      <PullToRefreshIndicator state="idle" pullDistance={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the three default labels per state", () => {
    const { rerender } = render(
      <PullToRefreshIndicator state="pulling" pullDistance={20} />,
    );
    expect(screen.getByRole("status").textContent).toContain("Pull to refresh");
    rerender(<PullToRefreshIndicator state="release" pullDistance={80} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Release to refresh",
    );
    rerender(<PullToRefreshIndicator state="refreshing" pullDistance={70} />);
    expect(screen.getByRole("status").textContent).toContain("Refreshing…");
  });

  it("accepts injected labels", () => {
    render(
      <PullToRefreshIndicator
        state="pulling"
        pullDistance={20}
        labels={{ pull: "Dra för att uppdatera" }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Dra för att uppdatera",
    );
  });
});
