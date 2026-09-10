// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ContextMenu,
  FLOATING_EDGE_ATTR,
  FloatingPanel,
  computeFloatingRect,
  forgetSafeArea,
  insetViewport,
  readEdgeInsets,
  type FloatingPlacement,
  type VisualViewportSnapshot,
} from "../src/components/index.ts";

const marked: HTMLElement[] = [];

afterEach(() => {
  // The probe cache and the marked chrome are both module- / document-level.
  forgetSafeArea();
  for (const el of marked.splice(0)) el.remove();
});

// An installed PWA on a notched phone: the layout viewport is the whole
// screen, the status bar owns the first 59px and the home indicator the last
// 34, and the app pins a 44px top bar under the status bar.
const SCREEN = { innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0 };
const RAW: VisualViewportSnapshot = {
  offsetTop: 0,
  height: SCREEN.innerHeight,
};
const INSETS = { top: 59 + 44, bottom: 34 };
const BAND = insetViewport(RAW, INSETS, SCREEN.innerHeight);

const PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 160 },
  anchor: "left",
  coordinateSpace: "viewport",
};

function triggerRect(top: number, height = 36): DOMRect {
  return {
    x: 16,
    y: top,
    top,
    left: 16,
    right: 374,
    bottom: top + height,
    width: 358,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** An element that reports the rect jsdom will not lay out for us. */
function markEdge(edge: "top" | "bottom", rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute(FLOATING_EDGE_ATTR, edge);
  el.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      width: 0,
      ...rect,
    }).valueOf() as DOMRect;
  document.body.append(el);
  marked.push(el);
  return el;
}

describe("insetViewport", () => {
  it("keeps the edges clear of the visible band", () => {
    expect(BAND).toEqual({ offsetTop: 103, height: 707 });
  });

  it("never gives back more than the engine reported", () => {
    // The soft keyboard already shrank the viewport past our insets.
    const keyboard: VisualViewportSnapshot = { offsetTop: 120, height: 380 };
    expect(insetViewport(keyboard, INSETS, SCREEN.innerHeight)).toEqual({
      offsetTop: 120,
      height: 380,
    });
  });

  it("collapses to zero rather than inverting", () => {
    expect(insetViewport({ offsetTop: 0, height: 90 }, INSETS, 90).height).toBe(
      0,
    );
  });
});

describe("a panel that flips above its trigger", () => {
  it("stops at the reserved top edge, not the top of the screen", () => {
    // Low enough on the screen that there is no useful room below.
    const r = computeFloatingRect(triggerRect(700), PLACEMENT, BAND, SCREEN);
    expect(r.placement).toBe("above");
    // It grows upward from `top`, so its highest pixel is `top - maxHeight`.
    expect(r.top - r.maxHeight).toBeGreaterThanOrEqual(BAND.offsetTop);
  });

  it("ran under the status bar when measured against the raw viewport", () => {
    const r = computeFloatingRect(triggerRect(700), PLACEMENT, RAW, SCREEN);
    expect(r.top - r.maxHeight).toBeLessThan(INSETS.top);
  });

  it("does not let the 120px floor push it past the edge", () => {
    // Only ~50px of room above the trigger inside the band.
    const cramped: VisualViewportSnapshot = { offsetTop: 100, height: 600 };
    const r = computeFloatingRect(triggerRect(158, 500), PLACEMENT, cramped, {
      ...SCREEN,
      innerHeight: 700,
    });
    expect(r.placement).toBe("above");
    expect(r.maxHeight).toBeLessThan(120);
    expect(r.top - r.maxHeight).toBeGreaterThanOrEqual(cramped.offsetTop);
  });
});

describe("a panel that opens below its trigger", () => {
  it("stops short of the reserved bottom edge", () => {
    const r = computeFloatingRect(triggerRect(200), PLACEMENT, BAND, SCREEN);
    expect(r.placement).toBe("below");
    expect(r.top + r.maxHeight).toBeLessThanOrEqual(
      BAND.offsetTop + BAND.height,
    );
  });
});

describe("readEdgeInsets", () => {
  it("is all zeroes with no insets and no marked chrome", () => {
    expect(readEdgeInsets(844)).toEqual({ top: 0, bottom: 0 });
  });

  it("reserves down to the bottom of chrome marked at the top edge", () => {
    markEdge("top", { top: 0, bottom: 96, height: 96 });
    expect(readEdgeInsets(844).top).toBe(96);
  });

  it("reserves up from the top of chrome marked at the bottom edge", () => {
    markEdge("bottom", { top: 780, bottom: 844, height: 64 });
    expect(readEdgeInsets(844).bottom).toBe(64);
  });

  it("takes the lowest of several marked bars and ignores hidden ones", () => {
    markEdge("top", { top: 0, bottom: 40, height: 40 });
    markEdge("top", { top: 0, bottom: 120, height: 120 });
    markEdge("top", { top: 0, bottom: 900, height: 0 });
    expect(readEdgeInsets(844).top).toBe(120);
  });
});

describe("a floating panel in a rendered app", () => {
  it("opens below the app's top bar rather than over it", () => {
    markEdge("top", { top: 0, bottom: 100, height: 100 });
    render(
      <ContextMenu
        position={{ x: 40, y: 10 }}
        onClose={() => {}}
        ariaLabel="Row actions"
        actions={[{ label: "Copy", onSelect: () => {} }]}
      />,
    );
    const panel = screen.getByRole("menu", { name: "Row actions" })
      .parentElement as HTMLElement;
    // Without the reserved edge this would sit at the pointer: 10 + 2px gap.
    expect(panel.style.top).toBe("108px");
  });

  it("still opens at the pointer when the placement opts out", () => {
    markEdge("top", { top: 0, bottom: 100, height: 100 });
    render(
      <FloatingPanel
        open
        onClose={() => {}}
        anchorPoint={{ x: 40, y: 10 }}
        placement={{ ...PLACEMENT, gap: 2, edges: "none" }}
      >
        <span data-testid="body">Body</span>
      </FloatingPanel>,
    );
    const panel = screen.getByTestId("body").parentElement as HTMLElement;
    expect(panel.style.top).toBe("12px");
  });
});
