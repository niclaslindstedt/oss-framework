// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSwipeDownToClose } from "../src/hooks/useSwipeDownToClose.ts";
import { Modal } from "../src/components/Modal.tsx";

// jsdom can't construct TouchEvent, so build the event ourselves and attach a
// minimal `touches` list the hook reads (`length`, `[0].clientX/Y`). The state
// updates the hook fires must flush inside `act`. Events target a specific
// element (the hook listens on the card it was handed), not the document.
function dispatchTouch(
  el: Element,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  point: { x: number; y: number } | null,
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", {
    value: point === null ? [] : [{ clientX: point.x, clientY: point.y }],
    configurable: true,
  });
  Object.defineProperty(ev, "target", { value: el, configurable: true });
  act(() => {
    el.dispatchEvent(ev);
  });
}

function Harness({
  onClose,
  closeDistance,
  enabled = true,
}: {
  onClose: () => void;
  closeDistance?: number;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { offset, dragging, closing } = useSwipeDownToClose(ref, onClose, {
    closeDistance,
    enabled,
  });
  return (
    <div
      ref={ref}
      data-testid="card"
      data-offset={offset}
      data-dragging={String(dragging)}
      data-closing={String(closing)}
    >
      <header data-testid="header">title</header>
    </div>
  );
}

describe("useSwipeDownToClose", () => {
  it("pulls the card with a downward drag and closes past the threshold", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<Harness onClose={onClose} closeDistance={100} />);
      const card = screen.getByTestId("card");
      const header = screen.getByTestId("header");

      dispatchTouch(header, "touchstart", { x: 20, y: 10 });
      dispatchTouch(header, "touchmove", { x: 20, y: 130 }); // dy = 120
      expect(Number(card.getAttribute("data-offset"))).toBe(120);
      expect(card.getAttribute("data-dragging")).toBe("true");

      // The release commits the dismiss but doesn't close immediately — the
      // card animates out first: `closing` turns on, the live drag ends, and
      // the offset holds (jsdom can't measure the card, so it stays at travel).
      dispatchTouch(header, "touchend", null);
      expect(card.getAttribute("data-closing")).toBe("true");
      expect(card.getAttribute("data-dragging")).toBe("false");
      expect(Number(card.getAttribute("data-offset"))).toBe(120);
      expect(onClose).not.toHaveBeenCalled();

      // `onClose` fires once the glide-out animation has had time to play.
      act(() => {
        vi.runAllTimers();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes at once, skipping the glide-out, when reduced motion is preferred", () => {
    const onClose = vi.fn();
    // jsdom ships no `matchMedia`; stand one in that reports the reduce
    // preference so the hook takes its no-animation path.
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      render(<Harness onClose={onClose} closeDistance={100} />);
      const card = screen.getByTestId("card");
      const header = screen.getByTestId("header");

      dispatchTouch(header, "touchstart", { x: 20, y: 10 });
      dispatchTouch(header, "touchmove", { x: 20, y: 130 }); // dy = 120
      dispatchTouch(header, "touchend", null);

      // No exit animation: closes synchronously and never enters `closing`.
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(card.getAttribute("data-closing")).toBe("false");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("snaps back without closing when the drag falls short", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeDistance={100} />);
    const card = screen.getByTestId("card");

    dispatchTouch(card, "touchstart", { x: 20, y: 10 });
    dispatchTouch(card, "touchmove", { x: 20, y: 50 }); // dy = 40, short
    expect(Number(card.getAttribute("data-offset"))).toBe(40);

    dispatchTouch(card, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
    expect(Number(card.getAttribute("data-offset"))).toBe(0);
    expect(card.getAttribute("data-dragging")).toBe("false");
  });

  it("ignores an upward drag (resting at 0)", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const card = screen.getByTestId("card");

    dispatchTouch(card, "touchstart", { x: 20, y: 100 });
    dispatchTouch(card, "touchmove", { x: 20, y: 60 }); // upward
    expect(Number(card.getAttribute("data-offset"))).toBe(0);

    dispatchTouch(card, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stands down when the gesture locks horizontal", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeDistance={100} />);
    const card = screen.getByTestId("card");

    dispatchTouch(card, "touchstart", { x: 10, y: 10 });
    // Horizontal dominates → axis locks 'h' and the drag disarms.
    dispatchTouch(card, "touchmove", { x: 90, y: 14 });
    dispatchTouch(card, "touchmove", { x: 90, y: 140 }); // even a later down move is inert
    expect(Number(card.getAttribute("data-offset"))).toBe(0);

    dispatchTouch(card, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hands the touch back to a content region scrolled below its top", () => {
    const onClose = vi.fn();
    function ScrollHarness() {
      const ref = useRef<HTMLDivElement>(null);
      const { offset } = useSwipeDownToClose(ref, onClose, {
        closeDistance: 100,
      });
      return (
        <div ref={ref} data-testid="card" data-offset={offset}>
          <div data-testid="scroller" style={{ overflowY: "auto" }}>
            content
          </div>
        </div>
      );
    }
    render(<ScrollHarness />);
    const scroller = screen.getByTestId("scroller");
    // Make it a scrollable region parked below its top.
    Object.defineProperty(scroller, "scrollHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(scroller, "clientHeight", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(scroller, "scrollTop", {
      value: 50,
      configurable: true,
    });

    dispatchTouch(scroller, "touchstart", { x: 20, y: 10 });
    dispatchTouch(scroller, "touchmove", { x: 20, y: 200 });
    // Never armed — the drag belongs to the scroll, not the dismiss.
    expect(Number(screen.getByTestId("card").getAttribute("data-offset"))).toBe(
      0,
    );
    dispatchTouch(scroller, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} enabled={false} closeDistance={100} />);
    const card = screen.getByTestId("card");

    dispatchTouch(card, "touchstart", { x: 20, y: 10 });
    dispatchTouch(card, "touchmove", { x: 20, y: 200 });
    dispatchTouch(card, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
    expect(Number(card.getAttribute("data-offset"))).toBe(0);
  });
});

describe("Modal swipe-down-to-close", () => {
  it("closes the full-screen sheet on a downward swipe", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} labelledBy="t">
          <h2 id="t">Sheet</h2>
        </Modal>,
      );
      const dialog = screen.getByRole("dialog");

      dispatchTouch(dialog, "touchstart", { x: 20, y: 10 });
      dispatchTouch(dialog, "touchmove", { x: 20, y: 160 }); // dy = 150
      // The sheet animates out before closing, so the release defers `onClose`
      // until the dismiss timer fires.
      dispatchTouch(dialog, "touchend", null);
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.runAllTimers();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not swipe-close a centered card", () => {
    const onClose = vi.fn();
    render(
      <Modal open centered onClose={onClose} labelledBy="t">
        <h2 id="t">Dialog</h2>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");

    dispatchTouch(dialog, "touchstart", { x: 20, y: 10 });
    dispatchTouch(dialog, "touchmove", { x: 20, y: 200 });
    dispatchTouch(dialog, "touchend", null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still closes a centered card via the backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal open centered onClose={onClose} labelledBy="t" closeLabel="Close">
        <h2 id="t">Dialog</h2>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
