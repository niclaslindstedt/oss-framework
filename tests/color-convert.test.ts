// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  contrastingInk,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  relativeLuminance,
  sameColor,
  withAlpha,
} from "../src/color/convert.ts";

describe("normalizeHex", () => {
  it("accepts the long form, with or without the hash", () => {
    expect(normalizeHex("#A1B2C3")).toBe("#a1b2c3");
    expect(normalizeHex("a1b2c3")).toBe("#a1b2c3");
    expect(normalizeHex("  #A1B2C3  ")).toBe("#a1b2c3");
  });

  it("expands the short form", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("f00")).toBe("#ff0000");
  });

  it("rejects anything else", () => {
    for (const bad of [
      "",
      "#",
      "#12",
      "#12345",
      "#1234567",
      "rebeccapurple",
      "#gg0000",
    ]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("hsvToHex", () => {
  it("puts the six primaries where they belong", () => {
    const full = (h: number) => hsvToHex({ h, s: 1, v: 1 });
    expect(full(0)).toBe("#ff0000");
    expect(full(60)).toBe("#ffff00");
    expect(full(120)).toBe("#00ff00");
    expect(full(180)).toBe("#00ffff");
    expect(full(240)).toBe("#0000ff");
    expect(full(300)).toBe("#ff00ff");
  });

  it("is black at zero value and white at zero saturation", () => {
    expect(hsvToHex({ h: 200, s: 0.8, v: 0 })).toBe("#000000");
    expect(hsvToHex({ h: 200, s: 0, v: 1 })).toBe("#ffffff");
  });

  it("wraps the hue and clamps the other two", () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: -60, s: 1, v: 1 })).toBe("#ff00ff");
    expect(hsvToHex({ h: 0, s: 5, v: 5 })).toBe("#ff0000");
    expect(hsvToHex({ h: 0, s: -5, v: -5 })).toBe("#000000");
  });
});

describe("hexToHsv", () => {
  it("round-trips every hue through hex and back", () => {
    // Within half a degree: hex is eight bits a channel, so a hue cannot
    // survive the trip more precisely than 360/255 of a degree.
    for (let h = 0; h < 360; h += 15) {
      const back = hexToHsv(hsvToHex({ h, s: 1, v: 1 }));
      expect(back.h).toBeCloseTo(h, 0);
      expect(back.s).toBeCloseTo(1, 2);
      expect(back.v).toBeCloseTo(1, 2);
    }
  });

  it("reads greys as having no saturation", () => {
    expect(hexToHsv("#808080").s).toBe(0);
    expect(hexToHsv("#ffffff")).toEqual({ h: 0, s: 0, v: 1 });
  });

  it("opens on black rather than throwing for junk", () => {
    expect(hexToHsv("not a colour")).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe("sameColor", () => {
  it("sees past case and the short form", () => {
    expect(sameColor("#FF0000", "f00")).toBe(true);
    expect(sameColor("#ff0000", "#ff0001")).toBe(false);
  });

  it("says two unparseable values are the same only vacuously", () => {
    // Both normalise to null; a caller filtering junk should do so first.
    expect(sameColor("junk", "other junk")).toBe(true);
    expect(sameColor("junk", "#ff0000")).toBe(false);
  });
});

describe("withAlpha", () => {
  it("renders an rgba string", () => {
    expect(withAlpha("#ff8000", 0.5)).toBe("rgba(255,128,0,0.500)");
  });

  it("clamps the alpha", () => {
    expect(withAlpha("#000000", 5)).toBe("rgba(0,0,0,1.000)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0,0,0,0.000)");
  });

  it("hands an unparseable colour straight back", () => {
    expect(withAlpha("currentColor", 0.5)).toBe("currentColor");
  });
});

describe("relativeLuminance", () => {
  it("runs from black to white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });

  it("weights green above red above blue", () => {
    expect(relativeLuminance("#00ff00")).toBeGreaterThan(
      relativeLuminance("#ff0000"),
    );
    expect(relativeLuminance("#ff0000")).toBeGreaterThan(
      relativeLuminance("#0000ff"),
    );
  });

  it("reads junk as black", () => {
    expect(relativeLuminance("nope")).toBe(0);
  });
});

describe("contrastingInk", () => {
  it("picks the readable one of black and white", () => {
    expect(contrastingInk("#ffffff")).toBe("#000000");
    expect(contrastingInk("#000000")).toBe("#ffffff");
    expect(contrastingInk("#ffff00")).toBe("#000000");
    expect(contrastingInk("#0000ff")).toBe("#ffffff");
  });

  it("always picks the higher-contrast of the two", () => {
    const ratio = (a: number, b: number) =>
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    for (const color of [
      "#123456",
      "#abcdef",
      "#808080",
      "#7f7f7f",
      "#00ff00",
    ]) {
      const l = relativeLuminance(color);
      const picked = contrastingInk(color);
      const chosen = ratio(l, picked === "#000000" ? 0 : 1);
      const other = ratio(l, picked === "#000000" ? 1 : 0);
      expect(chosen).toBeGreaterThanOrEqual(other);
    }
  });
});
