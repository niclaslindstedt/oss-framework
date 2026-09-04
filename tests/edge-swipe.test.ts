// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  classifyEdgeDrag,
  EDGE_OPEN_DISTANCE_PX,
  EDGE_ZONE_PX,
  inEdgeZone,
} from "../src/sidebar/edgeSwipe.ts";

const WIDTH = 393;

describe("inEdgeZone", () => {
  it("watches the left strip for a left-resting drawer", () => {
    expect(inEdgeZone(0, WIDTH, "left")).toBe(true);
    expect(inEdgeZone(EDGE_ZONE_PX, WIDTH, "left")).toBe(true);
    expect(inEdgeZone(EDGE_ZONE_PX + 1, WIDTH, "left")).toBe(false);
    expect(inEdgeZone(WIDTH, WIDTH, "left")).toBe(false);
  });

  it("watches the right strip for a right-resting drawer", () => {
    expect(inEdgeZone(WIDTH, WIDTH, "right")).toBe(true);
    expect(inEdgeZone(WIDTH - EDGE_ZONE_PX, WIDTH, "right")).toBe(true);
    expect(inEdgeZone(WIDTH - EDGE_ZONE_PX - 1, WIDTH, "right")).toBe(false);
    expect(inEdgeZone(0, WIDTH, "right")).toBe(false);
  });

  it("takes a caller's own zone", () => {
    expect(inEdgeZone(60, WIDTH, "left", 64)).toBe(true);
  });
});

describe("classifyEdgeDrag", () => {
  it("holds a short inward drag", () => {
    expect(classifyEdgeDrag(10, 2, "left")).toBe("pending");
    expect(classifyEdgeDrag(-10, 2, "right")).toBe("pending");
  });

  it("opens once the finger has gone far enough inward", () => {
    expect(classifyEdgeDrag(EDGE_OPEN_DISTANCE_PX, 0, "left")).toBe("menu");
    expect(classifyEdgeDrag(-EDGE_OPEN_DISTANCE_PX, 0, "right")).toBe("menu");
  });

  it("hands a mostly-vertical drag straight back to the surface", () => {
    expect(classifyEdgeDrag(10, 40, "left")).toBe("press");
    expect(classifyEdgeDrag(-10, -40, "right")).toBe("press");
  });

  it("hands an outward drag back rather than holding it forever", () => {
    // Dragging away from the watched edge can never open the drawer, but it
    // stays `pending` until the finger lifts — the surface replays it then.
    expect(classifyEdgeDrag(-60, 0, "left")).toBe("pending");
  });

  it("takes a caller's own distance", () => {
    expect(classifyEdgeDrag(20, 0, "left", 16)).toBe("menu");
  });
});
