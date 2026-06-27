// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useRowSwipe } from "../src/hooks/useRowSwipe.ts";

// jsdom doesn't implement pointer capture; the hook calls it once a drag locks
// onto the horizontal axis. Stub the trio as no-ops so the gesture runs.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(() => {
  vi.useRealTimers();
});

// A row whose live swipe state is mirrored onto data-attributes so the test can
// read the offset / open latch the gesture produces.
function Row({ onDismiss }: { onDismiss: () => void }) {
  const swipe = useRowSwipe(onDismiss);
  return (
    <div
      data-testid="fg"
      data-offset={swipe.offset}
      data-open={swipe.open}
      {...swipe.handlers}
    >
      row
    </div>
  );
}

function down(el: Element, x: number) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: x, clientY: 40 });
}
function move(el: Element, x: number) {
  fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: 40 });
}
function up(el: Element, x: number) {
  fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: 40 });
}

describe("useRowSwipe", () => {
  it("latches open on a left swipe past the threshold", () => {
    render(<Row onDismiss={() => {}} />);
    const fg = screen.getByTestId("fg");

    down(fg, 200);
    move(fg, 188); // arm: |dx| 12 > axis-lock 8, axis locks horizontal
    move(fg, 140); // dx -60, past the -48 latch point
    up(fg, 140);

    // Rests open exactly one action-strip width (96px) to the left.
    expect(fg.getAttribute("data-open")).toBe("true");
    expect(Number(fg.getAttribute("data-offset"))).toBe(-96);
  });

  it("settles back closed when a left swipe falls short", () => {
    render(<Row onDismiss={() => {}} />);
    const fg = screen.getByTestId("fg");

    down(fg, 200);
    move(fg, 188);
    move(fg, 180); // dx -20, short of the -48 latch
    up(fg, 180);

    expect(fg.getAttribute("data-open")).toBe("false");
    expect(Number(fg.getAttribute("data-offset"))).toBe(0);
  });

  it("fires onDismiss after the slide-off when flicked right past the threshold", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Row onDismiss={onDismiss} />);
    const fg = screen.getByTestId("fg");

    down(fg, 100);
    move(fg, 116); // arm horizontal
    move(fg, 210); // dx +110, past the +96 dismiss point
    up(fg, 210);

    // Deferred until the slide-off animation (180ms) completes.
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("snaps back on a right swipe when no onDismiss is wired", () => {
    // A row that offers only the left reveal passes no dismiss handler; a
    // right swipe past the usual threshold then has no outcome and settles back
    // closed rather than sliding the row off.
    function NoDismiss() {
      const swipe = useRowSwipe();
      return (
        <div
          data-testid="fg"
          data-offset={swipe.offset}
          data-open={swipe.open}
          {...swipe.handlers}
        >
          row
        </div>
      );
    }
    render(<NoDismiss />);
    const fg = screen.getByTestId("fg");

    down(fg, 100);
    move(fg, 116); // arm horizontal
    move(fg, 210); // dx +110, past the +96 dismiss point
    up(fg, 210);

    expect(fg.getAttribute("data-open")).toBe("false");
    expect(Number(fg.getAttribute("data-offset"))).toBe(0);
  });

  it("ignores a dominantly vertical drag (lets the list scroll)", () => {
    const onDismiss = vi.fn();
    render(<Row onDismiss={onDismiss} />);
    const fg = screen.getByTestId("fg");

    fireEvent.pointerDown(fg, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(fg, { pointerId: 1, clientX: 104, clientY: 160 });
    fireEvent.pointerUp(fg, { pointerId: 1, clientX: 104, clientY: 160 });

    expect(fg.getAttribute("data-open")).toBe("false");
    expect(Number(fg.getAttribute("data-offset"))).toBe(0);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("honours custom thresholds", () => {
    function Tight() {
      const swipe = useRowSwipe(() => {}, { openAt: 20, actionWidth: 40 });
      return (
        <div data-testid="fg" data-offset={swipe.offset} {...swipe.handlers}>
          row
        </div>
      );
    }
    render(<Tight />);
    const fg = screen.getByTestId("fg");

    down(fg, 200);
    move(fg, 188);
    move(fg, 175); // dx -25, past the tightened -20 latch
    up(fg, 175);

    expect(Number(fg.getAttribute("data-offset"))).toBe(-40);
  });
});
