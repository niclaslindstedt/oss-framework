// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CollapseRail, SidebarCollapseRail } from "../src/sidebar/index.ts";

// A pointer that can hover (a desktop); the rail hides itself until the cursor
// is over its band. `false` gives a touch device, which keeps the rail up.
function stubHover(hoverCapable: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("hover: hover") ? hoverCapable : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// The rail measures its own box against the cursor, and jsdom lays nothing
// out, so hand it a band to be inside of.
function stubRailBox(el: Element, box: Partial<DOMRect>) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 16,
    top: 0,
    bottom: 800,
    width: 16,
    height: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...box,
  } as DOMRect);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SidebarCollapseRail", () => {
  it("hugs the viewport edge collapsed and the panel's inner edge docked", () => {
    stubHover(true);
    const { rerender } = render(
      <SidebarCollapseRail
        collapsed
        side="left"
        label="Show sidebar"
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button").style.left).toBe("0px");
    rerender(
      <SidebarCollapseRail
        collapsed={false}
        side="left"
        label="Hide sidebar"
        onClick={() => {}}
      />,
    );
    // jsdom folds the constant arithmetic; the band is half a rail back from
    // the panel's 16rem inner edge either way.
    expect(screen.getByRole("button").style.left).toBe("calc(15.5rem)");
  });

  it("docks on the right edge when the sidebar does", () => {
    stubHover(true);
    render(
      <SidebarCollapseRail
        collapsed
        side="right"
        label="Show sidebar"
        onClick={() => {}}
      />,
    );
    const rail = screen.getByRole("button");
    expect(rail.style.right).toBe("0px");
    expect(rail.style.left).toBe("");
  });

  it("stays hidden until the pointer enters its band, then draws and takes presses", async () => {
    stubHover(true);
    const onClick = vi.fn();
    render(
      <SidebarCollapseRail
        collapsed={false}
        side="left"
        label="Hide sidebar"
        onClick={onClick}
      />,
    );
    const rail = screen.getByRole("button");
    const grip = rail.firstElementChild as HTMLElement;
    expect(grip.className).toContain("opacity-0");
    expect(grip.className).not.toContain("pointer-events-auto");

    stubRailBox(rail, { left: 240, right: 256 });
    // The hook coalesces moves to one measurement per frame, so let the frame
    // run before asking what it decided.
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 248, clientY: 400 }),
      );
      await new Promise((resolve) => setTimeout(resolve, 32));
    });
    expect(grip.className).toContain("pointer-events-auto");
    expect(grip.className).not.toContain("opacity-0");

    fireEvent.click(rail);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("stays visible on a device that cannot hover", () => {
    stubHover(false);
    render(
      <SidebarCollapseRail
        collapsed
        side="left"
        label="Show sidebar"
        onClick={() => {}}
      />,
    );
    const grip = screen.getByRole("button").firstElementChild as HTMLElement;
    expect(grip.className).toContain("pointer-events-auto");
  });

  it("reports its state to a screen reader", () => {
    stubHover(true);
    render(
      <SidebarCollapseRail
        collapsed
        side="left"
        label="Show sidebar"
        onClick={() => {}}
      />,
    );
    const rail = screen.getByRole("button", { name: "Show sidebar" });
    expect(rail.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("CollapseRail", () => {
  it("points down to fold away and up to restore", () => {
    const { rerender } = render(
      <CollapseRail collapsed={false} label="Hide footer" onClick={() => {}} />,
    );
    const rail = screen.getByRole("button", { name: "Hide footer" });
    expect(rail.getAttribute("aria-expanded")).toBe("true");
    const down = rail.querySelector("svg")?.outerHTML;
    rerender(<CollapseRail collapsed label="Show footer" onClick={() => {}} />);
    expect(rail.querySelector("svg")?.outerHTML).not.toBe(down);
  });

  it("takes the bottom inset when it is the panel's last child", () => {
    const { rerender } = render(
      <CollapseRail collapsed label="Show footer" onClick={() => {}} />,
    );
    const rail = screen.getByRole("button");
    expect(rail.className).not.toContain("safe-area-inset-bottom");
    rerender(
      <CollapseRail collapsed last label="Show footer" onClick={() => {}} />,
    );
    expect(rail.className).toContain("safe-area-inset-bottom");
  });
});
