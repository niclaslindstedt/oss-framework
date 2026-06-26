// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Sidebar,
  clampRect,
  clampUnit,
  rectToPosition,
  restingRect,
  useSidebarInset,
  type MenuButtonPosition,
  type SidebarProps,
} from "../src/sidebar/index.ts";

// --- pure geometry (position.ts) ----------------------------------------

describe("sidebar position geometry", () => {
  it("clamps a vertical fraction into [0, 1] and coerces non-finite to 0", () => {
    expect(clampUnit(0.5)).toBe(0.5);
    expect(clampUnit(-2)).toBe(0);
    expect(clampUnit(9)).toBe(1);
    expect(clampUnit(NaN)).toBe(0);
  });

  it("rests on the left margin and centres vertically", () => {
    // 1000x800 viewport, default 44px button, 12px margin. Left edge is the
    // margin; y=0.5 is the midpoint of the (800 - 2*12 - 44) travel.
    const r = restingRect({ side: "left", y: 0.5 }, 1000, 800);
    expect(r.left).toBe(12);
    expect(r.top).toBe(12 + 0.5 * (800 - 24 - 44));
  });

  it("rests against the right edge inset by margin + size", () => {
    const r = restingRect({ side: "right", y: 0 }, 1000, 800);
    expect(r.left).toBe(1000 - 12 - 44);
    expect(r.top).toBe(12);
  });

  it("keeps a free-dragged point inside the margin-inset box", () => {
    expect(clampRect(-50, -50, 1000, 800)).toEqual({ left: 12, top: 12 });
    expect(clampRect(5000, 5000, 1000, 800)).toEqual({
      left: 1000 - 12 - 44,
      top: 800 - 12 - 44,
    });
  });

  it("snaps a dropped point back to the nearer edge and its fraction", () => {
    // A point just left of centre snaps to the left edge; mirror for right.
    expect(rectToPosition(100, 12, 1000, 800).side).toBe("left");
    expect(rectToPosition(900, 12, 1000, 800).side).toBe("right");
    // Bottom of the travel rounds to y≈1, top to y=0.
    expect(rectToPosition(12, 800 - 12 - 44, 1000, 800).y).toBeCloseTo(1);
    expect(rectToPosition(12, 12, 1000, 800).y).toBe(0);
  });

  it("round-trips a saved position through resting and back", () => {
    const pos: MenuButtonPosition = { side: "right", y: 0.25 };
    const r = restingRect(pos, 1200, 900);
    expect(rectToPosition(r.left, r.top, 1200, 900)).toEqual(pos);
  });
});

// --- useSidebarInset -----------------------------------------------------

describe("useSidebarInset", () => {
  const root = document.documentElement;
  const left = () => root.style.getPropertyValue("--app-content-left");
  const right = () => root.style.getPropertyValue("--app-content-right");

  afterEach(() => {
    root.style.removeProperty("--app-content-left");
    root.style.removeProperty("--app-content-right");
  });

  it("insets the docked edge when pinned on either side", () => {
    const { unmount } = renderHook(() => useSidebarInset(true, "left"));
    expect(left()).toBe("16rem");
    expect(right()).toBe("0px");
    unmount();

    renderHook(() => useSidebarInset(true, "right"));
    expect(right()).toBe("16rem");
    expect(left()).toBe("0px");
  });

  it("publishes a zero inset when not pinned", () => {
    renderHook(() => useSidebarInset(false, "left"));
    expect(left()).toBe("0px");
    expect(right()).toBe("0px");
  });

  it("clears the variables on unmount so sidebar-less pages reset", () => {
    const { unmount } = renderHook(() => useSidebarInset(true, "left"));
    expect(left()).toBe("16rem");
    unmount();
    expect(left()).toBe("");
    expect(right()).toBe("");
  });
});

// --- Sidebar component ---------------------------------------------------

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const onToggle = vi.fn();
  const onClose = vi.fn();
  const onPositionChange = vi.fn();
  const utils = render(
    <Sidebar
      pinned={false}
      open={false}
      onToggle={onToggle}
      onClose={onClose}
      position={{ side: "left", y: 0.5 }}
      onPositionChange={onPositionChange}
      {...overrides}
    >
      <a href="#home">Home link</a>
    </Sidebar>,
  );
  return { onToggle, onClose, onPositionChange, ...utils };
}

describe("Sidebar", () => {
  it("docks a permanent nav with the content and no button when pinned", () => {
    renderSidebar({ pinned: true });
    const nav = screen.getByRole("navigation", { name: "Navigation" });
    expect(nav).toBeTruthy();
    expect(nav.className).toContain("w-64");
    expect(screen.getByText("Home link")).toBeTruthy();
    // No floating toggle in the pinned variant.
    expect(screen.queryByRole("button", { name: /navigation/i })).toBeNull();
  });

  it("docks on the right edge with order-last when the side is right", () => {
    renderSidebar({ pinned: true, position: { side: "right", y: 0.5 } });
    const nav = screen.getByRole("navigation", { name: "Navigation" });
    expect(nav.className).toContain("order-last");
    expect(nav.className).toContain("border-l");
  });

  it("renders only the floating button while the drawer is closed", () => {
    renderSidebar({ open: false });
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeTruthy();
    // The content lives in the drawer, which is not mounted while closed.
    expect(screen.queryByText("Home link")).toBeNull();
  });

  it("toggles open from the floating button press", () => {
    const { onToggle } = renderSidebar({ open: false });
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("mounts the drawer with its content when open", () => {
    renderSidebar({ open: true });
    expect(screen.getByRole("navigation", { name: "Navigation" })).toBeTruthy();
    expect(screen.getByText("Home link")).toBeTruthy();
  });

  it("closes from the backdrop and from Escape while open", () => {
    const { onClose } = renderSidebar({ open: true });
    // Two elements carry the close label: the button (open/close toggle) and
    // the backdrop. The backdrop is the tabIndex=-1 one.
    const closers = screen.getAllByRole("button", { name: "Close navigation" });
    const backdrop = closers.find((el) => el.getAttribute("tabindex") === "-1");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close on Escape when pinned (no drawer to dismiss)", () => {
    const { onClose } = renderSidebar({ pinned: true });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hides the floating button when showButton is false", () => {
    renderSidebar({ open: false, showButton: false });
    expect(
      screen.queryByRole("button", { name: "Open navigation" }),
    ).toBeNull();
  });

  it("applies overridden accessible labels", () => {
    renderSidebar({ open: false, labels: { open: "Menu" } });
    expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
  });
});
