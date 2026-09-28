// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLongPress, type LongPressOptions } from "../src/hooks/index.ts";

afterEach(() => {
  vi.useRealTimers();
});

function Probe({
  onLong,
  options,
}: {
  onLong: () => void;
  options?: LongPressOptions;
}) {
  const handlers = useLongPress(onLong, options);
  return (
    <div data-testid="row" {...handlers}>
      row
    </div>
  );
}

describe("useLongPress", () => {
  it("fires once after the pointer is held past the delay", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    render(<Probe onLong={onLong} />);
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    expect(onLong).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the pointer lifts before the delay", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    render(<Probe onLong={onLong} />);
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerUp(row);
    act(() => vi.advanceTimersByTime(300));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("cancels when the pointer drifts past the move tolerance", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    render(<Probe onLong={onLong} />);
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(row, { clientX: 60, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("ignores a secondary (right) button press", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    render(<Probe onLong={onLong} />);
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 2, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));
    expect(onLong).not.toHaveBeenCalled();
  });

  it("swallows the click that trails the press", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Probe onLong={onLong} />
      </div>,
    );
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(row);
    expect(onLong).toHaveBeenCalledTimes(1);
    // The trailing tap is captured and stopped, so the row's own click never
    // runs alongside the long press.
    expect(onClick).not.toHaveBeenCalled();
  });

  it("honours a custom delay", () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    render(<Probe onLong={onLong} options={{ delayMs: 800 }} />);
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));
    expect(onLong).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  // A press held well past the delay still ends in the click of its own
  // pointer-up, and that click must not activate the row: in an app where a
  // long press offers "skip" and a tap means "done", a leaked tap undoes the
  // choice the press just made. The swallow used to be a 400 ms window from
  // the moment the press fired, so any hold past ~0.9 s lifted into a tap.
  describe.each([600, 1500, 5000])("a %i ms hold", (holdMs) => {
    it("swallows the click that ends it", () => {
      vi.useFakeTimers();
      const onLong = vi.fn();
      const onClick = vi.fn();
      render(
        <div onClick={onClick}>
          <Probe onLong={onLong} />
        </div>,
      );
      const row = screen.getByTestId("row");

      fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(holdMs));
      fireEvent.pointerUp(row);
      fireEvent.click(row);
      expect(onLong).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("lets a normal tap through afterwards", () => {
      vi.useFakeTimers();
      const onLong = vi.fn();
      const onClick = vi.fn();
      render(
        <div onClick={onClick}>
          <Probe onLong={onLong} />
        </div>,
      );
      const row = screen.getByTestId("row");

      fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(holdMs));
      fireEvent.pointerUp(row);
      fireEvent.click(row);

      // The next gesture is a plain tap, and it is the row's.
      fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(80));
      fireEvent.pointerUp(row);
      fireEvent.click(row);
      expect(onLong).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  it("swallows only one click, even from a single gesture", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Probe onLong={vi.fn()} />
      </div>,
    );
    const row = screen.getByTestId("row");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(row);
    fireEvent.click(row);
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stands down when the gesture ends without a click", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Probe onLong={vi.fn()} />
      </div>,
    );
    const row = screen.getByTestId("row");

    // The OS took the pointer (a callout, a scroll) and no click followed.
    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.pointerCancel(row);
    act(() => vi.advanceTimersByTime(1000));
    // A later click with no pointer behind it — Enter on a focused row —
    // belongs to no press and goes through.
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
