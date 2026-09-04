// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP,
  isDoubleTap,
  isTap,
  TAP_SLOP,
  tapDistance,
} from "../src/hooks/tap.ts";

const at = (x: number, y: number) => ({ x, y });

describe("tapDistance", () => {
  it("is Euclidean", () => {
    expect(tapDistance(at(0, 0), at(3, 4))).toBe(5);
    expect(tapDistance(at(3, 4), at(0, 0))).toBe(5);
    expect(tapDistance(at(2, 2), at(2, 2))).toBe(0);
  });
});

describe("isTap", () => {
  it("forgives a finger's own wobble", () => {
    expect(isTap(at(100, 100), at(100, 100))).toBe(true);
    expect(isTap(at(100, 100), at(100 + TAP_SLOP, 100))).toBe(true);
  });

  it("calls anything past the slop a drag", () => {
    expect(isTap(at(100, 100), at(100 + TAP_SLOP + 1, 100))).toBe(false);
  });

  it("measures the diagonal, not each axis", () => {
    // 6 px each way is 8.49 px of travel — a drag, though neither axis is.
    expect(isTap(at(0, 0), at(6, 6))).toBe(false);
  });

  it("takes a caller's own slop", () => {
    expect(isTap(at(0, 0), at(20, 0), 24)).toBe(true);
  });
});

describe("isDoubleTap", () => {
  const first = { time: 1000, point: at(50, 50) };

  it("pairs two taps near enough in time and place", () => {
    expect(isDoubleTap(first, { time: 1100, point: at(52, 54) })).toBe(true);
  });

  it("is never a pair with nothing", () => {
    expect(isDoubleTap(null, { time: 1100, point: at(50, 50) })).toBe(false);
  });

  it("refuses a second tap that came too late", () => {
    expect(
      isDoubleTap(first, { time: 1000 + DOUBLE_TAP_MS, point: at(50, 50) }),
    ).toBe(true);
    expect(
      isDoubleTap(first, { time: 1001 + DOUBLE_TAP_MS, point: at(50, 50) }),
    ).toBe(false);
  });

  it("refuses a second tap that landed too far away", () => {
    expect(
      isDoubleTap(first, { time: 1100, point: at(50 + DOUBLE_TAP_SLOP, 50) }),
    ).toBe(true);
    expect(
      isDoubleTap(first, {
        time: 1100,
        point: at(51 + DOUBLE_TAP_SLOP, 50),
      }),
    ).toBe(false);
  });

  it("is more forgiving in place than a single tap is", () => {
    expect(DOUBLE_TAP_SLOP).toBeGreaterThan(TAP_SLOP);
  });
});
