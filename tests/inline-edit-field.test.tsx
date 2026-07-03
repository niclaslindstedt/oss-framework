// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InlineEditField } from "../src/components/InlineEditField.tsx";

// jsdom ships neither `matchMedia`, `scrollIntoView`, nor a `visualViewport`, so
// the field's soft-keyboard reveal has nothing real to drive it. Stand each one
// in with a controllable fake: `matchMedia` keyed on the coarse-pointer query,
// `scrollIntoView` a spy on the prototype, and a `visualViewport` whose `resize`
// listeners we can fire to simulate the keyboard settling.
type FakeVv = {
  listeners: Set<() => void>;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
};

let coarse = false;
let vvListeners: Set<() => void>;
const scrollIntoView = vi.fn();

function makeVv(): FakeVv {
  vvListeners = new Set();
  return {
    listeners: vvListeners,
    addEventListener: (_t, cb) => vvListeners.add(cb),
    removeEventListener: (_t, cb) => vvListeners.delete(cb),
  };
}

function fireViewportResize() {
  for (const cb of [...vvListeners]) cb();
}

beforeEach(() => {
  coarse = false;
  scrollIntoView.mockClear();
  vi.useFakeTimers();
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("coarse") ? coarse : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: makeVv(),
  });
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.useRealTimers();
});

const noop = () => {};

describe("InlineEditField soft-keyboard reveal", () => {
  it("centres the field into view once the keyboard settles on a touch device", () => {
    coarse = true;
    render(<InlineEditField onCommit={noop} onCancel={noop} />);

    // Nothing scrolls at focus time — the keyboard hasn't shrunk the viewport
    // yet, so revealing now would under-scroll.
    expect(scrollIntoView).not.toHaveBeenCalled();

    // The keyboard settles: the visual viewport resizes, and the field centres.
    fireViewportResize();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("does not scroll on a precise-pointer device", () => {
    coarse = false;
    render(<InlineEditField onCommit={noop} onCancel={noop} />);

    fireViewportResize();
    vi.advanceTimersByTime(1000);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("reveals via the timeout backstop when no resize fires", () => {
    coarse = true;
    render(<InlineEditField onCommit={noop} onCancel={noop} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("reveals only once even if both the resize and the timeout fire", () => {
    coarse = true;
    render(<InlineEditField onCommit={noop} onCancel={noop} />);

    fireViewportResize();
    vi.advanceTimersByTime(1000);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
