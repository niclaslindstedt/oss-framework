// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { useDragDrop } from "../src/sidebar/index.ts";

// jsdom has no real layout engine and no Pointer Capture; stub the capture API
// (the hook guards every call but the stubs keep the happy path honest) and let
// each test stamp the bounding boxes its zones should report.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

type Rect = { left: number; top: number; right: number; bottom: number };

function setRect(el: HTMLElement, rect: Rect) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      toJSON: () => "",
    }) as DOMRect;
}

type Drag = { id: string };
type Target = { id: string };

// A bare host: one drag handle plus a set of named drop zones, each reflecting
// its live `isOver` / `isActive` into data-attributes for assertions.
function Host({
  onDrop,
  canDrop,
  zones,
}: {
  onDrop: (drag: Drag, target: Target) => void;
  canDrop?: (drag: Drag, target: Target) => boolean;
  zones: string[];
}) {
  const dnd = useDragDrop<Drag, Target>({ onDrop, canDrop });
  return (
    <div>
      <div data-testid="handle" {...dnd.dragHandle({ id: "item" })}>
        grip
      </div>
      {dnd.dragging && <div data-testid="dragging">{dnd.dragging.id}</div>}
      {zones.map((id) => {
        const z = dnd.dropZone(id, { id });
        return (
          <div
            key={id}
            data-testid={`zone-${id}`}
            data-over={z.isOver}
            data-active={z.isActive}
            ref={z.ref}
          />
        );
      })}
    </div>
  );
}

function down(el: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
    clientX: x,
    clientY: y,
  });
}
function move(el: HTMLElement, x: number, y: number) {
  fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y });
}
function up(el: HTMLElement, x: number, y: number) {
  fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: y });
}

describe("useDragDrop", () => {
  it("drops the payload onto the zone under the pointer on release", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<Host onDrop={onDrop} zones={["A"]} />);
    setRect(getByTestId("zone-A"), {
      left: 40,
      top: 40,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 60, 60); // past the 6px threshold, into zone A
    expect(getByTestId("dragging").textContent).toBe("item");
    expect(getByTestId("zone-A").getAttribute("data-over")).toBe("true");
    up(handle, 60, 60);

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({ id: "item" }, { id: "A" });
  });

  it("treats a press that never crosses the threshold as a tap, not a drag", () => {
    const onDrop = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <Host onDrop={onDrop} zones={["A"]} />,
    );
    setRect(getByTestId("zone-A"), {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 50, 50);
    move(handle, 53, 52); // 3px — under the threshold
    up(handle, 53, 52);

    expect(queryByTestId("dragging")).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("releasing away from every zone drops nothing", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<Host onDrop={onDrop} zones={["A"]} />);
    setRect(getByTestId("zone-A"), {
      left: 40,
      top: 40,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 200, 200); // nowhere near zone A
    expect(getByTestId("zone-A").getAttribute("data-over")).toBe("false");
    up(handle, 200, 200);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("never lights up or drops on a zone that rejects the drag", () => {
    const onDrop = vi.fn();
    const canDrop = (_drag: Drag, target: Target) => target.id !== "B";
    const { getByTestId } = render(
      <Host onDrop={onDrop} canDrop={canDrop} zones={["B"]} />,
    );
    setRect(getByTestId("zone-B"), {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 50, 50); // over B, but B is rejected
    // A rejected zone stays dark (not an active target) and not hovered.
    expect(getByTestId("zone-B").getAttribute("data-active")).toBe("false");
    expect(getByTestId("zone-B").getAttribute("data-over")).toBe("false");
    up(handle, 50, 50);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("flags every accepting zone as active for the duration of a drag", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<Host onDrop={onDrop} zones={["A", "B"]} />);
    setRect(getByTestId("zone-A"), { left: 0, top: 0, right: 50, bottom: 50 });
    setRect(getByTestId("zone-B"), {
      left: 60,
      top: 0,
      right: 110,
      bottom: 50,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 200, 200); // dragging, but over neither
    expect(getByTestId("zone-A").getAttribute("data-active")).toBe("true");
    expect(getByTestId("zone-B").getAttribute("data-active")).toBe("true");
    expect(getByTestId("zone-A").getAttribute("data-over")).toBe("false");
    up(handle, 200, 200);
    // Drag over — the active cue clears.
    expect(getByTestId("zone-A").getAttribute("data-active")).toBe("false");
  });

  it("picks the smallest (innermost) zone when boxes nest", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(
      <Host onDrop={onDrop} zones={["outer", "inner"]} />,
    );
    setRect(getByTestId("zone-outer"), {
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
    });
    setRect(getByTestId("zone-inner"), {
      left: 40,
      top: 40,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 50, 50); // inside both — inner wins
    expect(getByTestId("zone-inner").getAttribute("data-over")).toBe("true");
    expect(getByTestId("zone-outer").getAttribute("data-over")).toBe("false");
    up(handle, 50, 50);

    expect(onDrop).toHaveBeenCalledWith({ id: "item" }, { id: "inner" });
  });

  it("cancelling the pointer aborts without a drop", () => {
    const onDrop = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <Host onDrop={onDrop} zones={["A"]} />,
    );
    setRect(getByTestId("zone-A"), {
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
    });

    const handle = getByTestId("handle");
    down(handle, 5, 5);
    move(handle, 50, 50);
    fireEvent.pointerCancel(handle, { pointerId: 1, clientX: 50, clientY: 50 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(queryByTestId("dragging")).toBeNull();
  });
});
