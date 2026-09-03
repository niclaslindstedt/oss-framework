// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { useRef, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSwipeNav, type SwipeNavOptions } from "../src/hooks/index.ts";

function Pager({
  onSwipe,
  options,
  children,
}: {
  onSwipe: (direction: 1 | -1) => void;
  options?: SwipeNavOptions;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeNav(ref, onSwipe, options);
  return (
    <div ref={ref} data-testid="root">
      <span data-testid="content">page</span>
      {children}
    </div>
  );
}

/** A one-finger drag from (x0, y0) to (x1, y1) on `target`. */
function drag(
  target: Element,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
) {
  const at = (x: number, y: number) => [{ target, clientX: x, clientY: y }];
  fireEvent.touchStart(target, { touches: at(x0, y0) });
  fireEvent.touchMove(target, { touches: at(x1, y1) });
  fireEvent.touchEnd(target, { changedTouches: at(x1, y1) });
}

describe("useSwipeNav", () => {
  it("reports the direction the content moves", () => {
    const onSwipe = vi.fn();
    render(<Pager onSwipe={onSwipe} />);
    const root = screen.getByTestId("root");

    // Right to left brings the next page in from the right.
    drag(screen.getByTestId("content"), [200, 100], [100, 105]);
    expect(onSwipe).toHaveBeenLastCalledWith(1);

    drag(root, [100, 100], [220, 96]);
    expect(onSwipe).toHaveBeenLastCalledWith(-1);
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it("ignores a drag too short to be anything but a slipped tap", () => {
    const onSwipe = vi.fn();
    render(<Pager onSwipe={onSwipe} />);
    drag(screen.getByTestId("content"), [200, 100], [160, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("gives an ambiguous diagonal to the scroller", () => {
    const onSwipe = vi.fn();
    render(<Pager onSwipe={onSwipe} />);
    drag(screen.getByTestId("content"), [200, 100], [100, 220]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("bails when a second finger lands — a pinch is not a swipe", () => {
    const onSwipe = vi.fn();
    render(<Pager onSwipe={onSwipe} />);
    const target = screen.getByTestId("content");
    const at = (x: number) => ({ target, clientX: x, clientY: 100 });

    fireEvent.touchStart(target, { touches: [at(200)] });
    fireEvent.touchMove(target, { touches: [at(160), at(80)] });
    fireEvent.touchEnd(target, { changedTouches: [at(100)] });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("stands down on a control that owns the horizontal axis", () => {
    const onSwipe = vi.fn();
    render(
      <Pager onSwipe={onSwipe}>
        <input type="range" data-testid="slider" />
        <div data-swipe-ignore data-testid="claimed">
          inner
        </div>
      </Pager>,
    );

    drag(screen.getByTestId("slider"), [200, 100], [100, 100]);
    drag(screen.getByTestId("claimed"), [200, 100], [100, 100]);
    expect(onSwipe).not.toHaveBeenCalled();

    // …but not on the rest of the page.
    drag(screen.getByTestId("content"), [200, 100], [100, 100]);
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("reads a marker on its OWN root as a claim, not a veto", () => {
    // This is what lets a swipeable region nest inside a swipeable screen:
    // the marker stops the outer mount and the inner one proceeds through it.
    const onSwipe = vi.fn();
    function Inner() {
      const ref = useRef<HTMLDivElement>(null);
      useSwipeNav(ref, onSwipe);
      return (
        <div ref={ref} data-swipe-ignore data-testid="inner">
          <span data-testid="inner-content">month</span>
        </div>
      );
    }
    render(<Inner />);
    drag(screen.getByTestId("inner-content"), [200, 100], [100, 100]);
    expect(onSwipe).toHaveBeenCalledWith(1);
  });

  it("honours the tuned thresholds and the enabled flag", () => {
    const onSwipe = vi.fn();
    const { unmount } = render(
      <Pager onSwipe={onSwipe} options={{ minDistance: 20 }} />,
    );
    drag(screen.getByTestId("content"), [200, 100], [170, 100]);
    expect(onSwipe).toHaveBeenCalledTimes(1);
    unmount();

    render(<Pager onSwipe={onSwipe} options={{ enabled: false }} />);
    drag(screen.getByTestId("content"), [200, 100], [100, 100]);
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("unbinds on unmount", () => {
    const onSwipe = vi.fn();
    const { unmount } = render(<Pager onSwipe={onSwipe} />);
    const target = screen.getByTestId("content");
    unmount();
    drag(target, [200, 100], [100, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
