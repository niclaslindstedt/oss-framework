// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";

import { useDialogDrag } from "../src/components/useDialogDrag.ts";

// jsdom implements no layout, so every rect is zero-sized at the origin — and
// the hook's clamp (which keeps a grabbable strip of the card on screen) is
// entirely a function of the card's rect. Give the card a real one, centred in
// jsdom's 1024 x 768 window, or every assertion below measures the clamp's
// degenerate case rather than the drag.
const CARD_RECT = { left: 300, top: 200, width: 400, height: 300 };

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  const real = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if (!(this as Element).matches?.('[role="dialog"]')) return real.call(this);
    const self = this as HTMLElement;
    // The rect a browser would report: the resting position plus whatever
    // offset is currently applied.
    const dx = parseFloat(self.style.getPropertyValue("--dialog-drag-x")) || 0;
    const dy = parseFloat(self.style.getPropertyValue("--dialog-drag-y")) || 0;
    const left = CARD_RECT.left + dx;
    const top = CARD_RECT.top + dy;
    return {
      x: left,
      y: top,
      left,
      top,
      width: CARD_RECT.width,
      height: CARD_RECT.height,
      right: left + CARD_RECT.width,
      bottom: top + CARD_RECT.height,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

function Dialog({ enabled = true }: { enabled?: boolean }) {
  const drag = useDialogDrag(enabled);
  return (
    <div role="dialog" aria-label="Adjust" data-testid="card">
      <div
        data-testid="grip"
        ref={drag.gripRef}
        onPointerDown={drag.onPointerDown}
        onKeyDown={drag.onKeyDown}
        tabIndex={0}
      >
        <span>Adjust</span>
        <button type="button">Close</button>
      </div>
      {drag.moved && (
        <button type="button" onClick={drag.recentre}>
          Recentre
        </button>
      )}
    </div>
  );
}

const card = () => screen.getByTestId("card");
const grip = () => screen.getByTestId("grip");
const offset = () => [
  card().style.getPropertyValue("--dialog-drag-x"),
  card().style.getPropertyValue("--dialog-drag-y"),
];

function dragTo(x: number, y: number, from = { x: 0, y: 0 }) {
  fireEvent.pointerDown(grip(), {
    pointerId: 1,
    clientX: from.x,
    clientY: from.y,
  });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });
}

describe("useDialogDrag", () => {
  it("opens centred, with nothing to go back from", () => {
    render(<Dialog />);
    expect(offset()).toEqual(["", ""]);
    expect(screen.queryByRole("button", { name: "Recentre" })).toBeNull();
  });

  it("writes the drag as custom properties on the dialog card", () => {
    render(<Dialog />);
    dragTo(60, 40);
    expect(offset()).toEqual(["60px", "40px"]);
  });

  it("offers the way back only once it has been moved", () => {
    render(<Dialog />);
    dragTo(30, 30);
    fireEvent.click(screen.getByRole("button", { name: "Recentre" }));
    expect(offset()).toEqual(["", ""]);
    expect(screen.queryByRole("button", { name: "Recentre" })).toBeNull();
  });

  it("continues from where the last drag left it", () => {
    render(<Dialog />);
    dragTo(20, 10);
    dragTo(50, 30, { x: 20, y: 10 });
    expect(offset()).toEqual(["50px", "30px"]);
  });

  it("keeps the top edge on screen, however far up it is dragged", () => {
    render(<Dialog />);
    dragTo(0, -500);
    // The card rests 200 px down, so -200 is as far up as it can go.
    expect(offset()[1]).toBe("-200px");
  });

  it("keeps a grabbable strip of the card on screen sideways", () => {
    render(<Dialog />);
    dragTo(5000, 0);
    // 1024 - 48 - 300: the card's left edge stops 48 px short of the right.
    expect(offset()[0]).toBe("676px");
  });

  it("moves from the keyboard, further with Shift", () => {
    render(<Dialog />);
    fireEvent.keyDown(grip(), { key: "ArrowRight" });
    expect(offset()[0]).toBe("24px");
    fireEvent.keyDown(grip(), { key: "ArrowRight", shiftKey: true });
    expect(offset()[0]).toBe("72px");
    fireEvent.keyDown(grip(), { key: "ArrowDown" });
    expect(offset()[1]).toBe("24px");
  });

  it("leaves other keys alone", () => {
    render(<Dialog />);
    fireEvent.keyDown(grip(), { key: "Enter" });
    expect(offset()).toEqual(["", ""]);
  });

  it("leaves a press on a control in the title row to the control", () => {
    render(<Dialog />);
    const close = screen.getByRole("button", { name: "Close" });
    fireEvent.pointerDown(close, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 80, clientY: 80 });
    expect(offset()).toEqual(["", ""]);
  });

  it("does nothing at all while disabled", () => {
    render(<Dialog enabled={false} />);
    dragTo(60, 40);
    fireEvent.keyDown(grip(), { key: "ArrowRight" });
    expect(offset()).toEqual(["", ""]);
  });

  it("recentres when the drag stops being offered", () => {
    function Resizing() {
      const [wide, setWide] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setWide(false)}>
            Narrow
          </button>
          <Dialog enabled={wide} />
        </>
      );
    }
    render(<Resizing />);
    dragTo(60, 40);
    expect(offset()).toEqual(["60px", "40px"]);
    fireEvent.click(screen.getByRole("button", { name: "Narrow" }));
    expect(offset()).toEqual(["", ""]);
  });
});
