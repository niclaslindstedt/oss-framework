// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContextMenu,
  computeFloatingRect,
  type FloatingPlacement,
} from "../src/components/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

// The panel `ContextMenu` positions is the floating wrapper around the
// `role="menu"` element.
function panelOf(menu: HTMLElement): HTMLElement {
  return menu.parentElement as HTMLElement;
}

describe("ContextMenu", () => {
  it("renders nothing while position is null", () => {
    render(
      <ContextMenu
        position={null}
        onClose={() => {}}
        actions={[{ label: "Copy", onSelect: () => {} }]}
      />,
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a keyboard-focused menu at the pointer coordinates", () => {
    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        onClose={() => {}}
        ariaLabel="Item actions"
        actions={[{ label: "Copy", onSelect: () => {} }]}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Item actions" });
    expect(document.activeElement).toBe(menu);

    // Anchored just below the cursor (the 2px gap), left edge on the point.
    const panel = panelOf(menu);
    expect(panel.style.left).toBe("100px");
    expect(panel.style.top).toBe("102px");
  });

  it("fires the chosen action and closes", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={onClose}
        actions={[
          { label: "Copy", onSelect: () => {} },
          { label: "Delete", onSelect, danger: true },
        ]}
      />,
    );

    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports arrow-key navigation and Enter", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={() => {}}
        actions={[
          { label: "Copy", onSelect: first },
          { label: "Delete", onSelect: second },
        ]}
      />,
    );

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "Enter" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("supports Home / End / ArrowUp wrap and Space", () => {
    const first = vi.fn();
    const last = vi.fn();
    const { rerender } = render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={() => {}}
        actions={[
          { label: "Copy", onSelect: first },
          { label: "Move", onSelect: () => {} },
          { label: "Delete", onSelect: last },
        ]}
      />,
    );

    let menu = screen.getByRole("menu");
    // End jumps to the last row; Space activates like Enter.
    fireEvent.keyDown(menu, { key: "End" });
    fireEvent.keyDown(menu, { key: " " });
    expect(last).toHaveBeenCalledTimes(1);

    rerender(
      <ContextMenu
        position={{ x: 60, y: 60 }}
        onClose={() => {}}
        actions={[
          { label: "Copy", onSelect: first },
          { label: "Move", onSelect: () => {} },
          { label: "Delete", onSelect: last },
        ]}
      />,
    );
    menu = screen.getByRole("menu");
    // Home selects the first row; ArrowUp from it wraps to the last, and a
    // second Home returns — Enter fires the first action.
    fireEvent.keyDown(menu, { key: "Home" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "Home" });
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("hover moves the keyboard highlight", () => {
    const hovered = vi.fn();
    render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={() => {}}
        actions={[
          { label: "Copy", onSelect: () => {} },
          { label: "Delete", onSelect: hovered, danger: true },
        ]}
      />,
    );

    const menu = screen.getByRole("menu");
    const del = within(menu).getByRole("menuitem", { name: "Delete" });
    fireEvent.mouseEnter(del);
    // The hovered (danger) row carries the highlight tint...
    expect(del.className).toContain("bg-danger/10");
    // ...and Enter activates it.
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(hovered).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={onClose}
        actions={[{ label: "Copy", onSelect: () => {} }]}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays closed with no actions", () => {
    render(
      <ContextMenu
        position={{ x: 50, y: 50 }}
        onClose={() => {}}
        actions={[]}
      />,
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

// The clamp / flip math for a point anchor — a zero-size rect at the pointer
// — goes through the same `computeFloatingRect` as element anchors.
describe("point-anchored floating position", () => {
  const placement: FloatingPlacement = {
    width: { kind: "min", minPx: 192 },
    anchor: "left",
    gap: 2,
    coordinateSpace: "viewport",
  };
  const vv = { offsetTop: 0, height: 768 };
  const win = { innerWidth: 1024, innerHeight: 768, scrollX: 0, scrollY: 0 };

  function pointRect(x: number, y: number): DOMRect {
    return {
      x,
      y,
      top: y,
      left: x,
      right: x,
      bottom: y,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect;
  }

  it("clamps the menu inside the right viewport edge", () => {
    const rect = computeFloatingRect(pointRect(1000, 100), placement, vv, win);
    // 1024 - 8 margin - 192 width = 824: the menu never spills off-screen.
    expect(rect.left).toBe(824);
    expect(rect.placement).toBe("below");
  });

  it("flips above the cursor near the bottom edge", () => {
    const rect = computeFloatingRect(pointRect(100, 700), placement, vv, win);
    expect(rect.placement).toBe("above");
    // "above" anchors the panel's bottom edge `gap` px over the point.
    expect(rect.top).toBe(698);
  });
});
