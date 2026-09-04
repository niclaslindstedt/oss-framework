// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  clipTextToBox,
  ellipsize,
  fitTextSize,
  sizeLadder,
  textLineLimit,
  textOverflowsWidth,
  textSlotHeight,
} from "../src/fit/measure.ts";

// jsdom does no layout, so the measured half of the module has to be given
// one. This is the simplest model that has the property the search relies on:
// a box `WIDTH_PX` wide, text that wraps at `WIDTH_PX / (fontSize * 0.6)`
// characters a line, and a line box `1.25 × fontSize` tall. Smaller type
// therefore fits more per line and never wraps to more lines, which is exactly
// the monotonicity `fitTextSize` binary-searches over.
const WIDTH_PX = 120;
const LINE_HEIGHT = 1.25;

function box(text: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  document.body.appendChild(el);
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get() {
      const px = parseFloat(this.style.fontSize) || 16;
      const perLine = Math.max(1, Math.floor(WIDTH_PX / (px * 0.6)));
      const chars = (this.firstChild?.nodeValue ?? "").length;
      const lines = Math.max(1, Math.ceil(chars / perLine));
      return lines * px * LINE_HEIGHT;
    },
  });
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ellipsize", () => {
  it("leaves text that fits alone", () => {
    expect(ellipsize("Supper", 6)).toBe("Supper");
    expect(ellipsize("Supper", 99)).toBe("Supper");
  });

  it("closes a cut with an ellipsis and trims the hanging space", () => {
    expect(ellipsize("Supper with Ann", 7)).toBe("Supper…");
    expect(ellipsize("Supper with Ann", 6)).toBe("Supper…");
  });

  it("cuts mid-word rather than dropping the word", () => {
    expect(ellipsize("Supper with Ann", 10)).toBe("Supper wit…");
  });

  it("is an ellipsis alone when nothing fits", () => {
    expect(ellipsize("Supper", 0)).toBe("…");
  });
});

describe("textLineLimit", () => {
  it("counts whole line boxes", () => {
    expect(textLineLimit(50, 16)).toBe(2);
    expect(textLineLimit(60, 16)).toBe(3);
  });

  it("absorbs a sub-pixel slot height", () => {
    expect(textLineLimit(41.99, 14 / LINE_HEIGHT)).toBe(3);
  });

  it("never reports fewer than one line", () => {
    expect(textLineLimit(0, 16)).toBe(1);
    expect(textLineLimit(-10, 16)).toBe(1);
    expect(textLineLimit(50, 0)).toBe(1);
  });

  it("takes a caller's own line height", () => {
    expect(textLineLimit(64, 16, 2)).toBe(2);
  });
});

describe("sizeLadder", () => {
  it("runs from the floor to the asked-for size in half-point rungs", () => {
    expect(sizeLadder(10, 8)).toEqual([8, 8.5, 9, 9.5, 10]);
  });

  it("is the size alone when there is no room below it", () => {
    expect(sizeLadder(8, 8)).toEqual([8]);
    expect(sizeLadder(8, 9)).toEqual([8]);
  });
});

describe("fitTextSize", () => {
  it("leaves short text at the size it was asked for", () => {
    const el = box("Tea");
    expect(fitTextSize(el, 200, 16, 8)).toEqual({ px: 16, fits: true });
    expect(el.style.fontSize).toBe("16px");
  });

  it("steps down until the text fits, and says it did", () => {
    const el = box("Supper with Ann and the neighbours");
    const fit = fitTextSize(el, 40, 16, 8);
    expect(fit.fits).toBe(true);
    expect(fit.px).toBeLessThan(16);
    expect(el.scrollHeight).toBeLessThanOrEqual(40.5);
  });

  it("picks the largest rung that fits, not just any", () => {
    const el = box("Supper with Ann and the neighbours");
    const { px } = fitTextSize(el, 40, 16, 8);
    el.style.fontSize = `${px + 0.5}px`;
    expect(el.scrollHeight).toBeGreaterThan(40.5);
  });

  it("stops at the floor and reports that it did not fit", () => {
    const el = box("x".repeat(400));
    const fit = fitTextSize(el, 30, 16, 8);
    expect(fit).toEqual({ px: 8, fits: false });
    expect(el.style.fontSize).toBe("8px");
  });

  it("calls an unmeasurable slot a fit rather than blocking typing", () => {
    const el = box("x".repeat(400));
    expect(fitTextSize(el, 0, 16, 8)).toEqual({ px: 16, fits: true });
    expect(fitTextSize(el, -5, 16, 8)).toEqual({ px: 16, fits: true });
  });
});

describe("clipTextToBox", () => {
  const text = "Supper with Ann and the neighbours, seven o'clock sharp";

  it("cuts the printed text down to what fits", () => {
    const el = box(text);
    el.style.fontSize = "16px";
    clipTextToBox(el, 60, text);
    const shown = el.firstChild!.nodeValue!;
    expect(shown.endsWith("…")).toBe(true);
    expect(shown.length).toBeLessThan(text.length);
    expect(el.scrollHeight).toBeLessThanOrEqual(60.5);
  });

  it("keeps as much as it can", () => {
    const el = box(text);
    el.style.fontSize = "16px";
    clipTextToBox(el, 60, text);
    const kept = el.firstChild!.nodeValue!.length;
    el.firstChild!.nodeValue = ellipsize(text, kept + 4);
    expect(el.scrollHeight).toBeGreaterThan(60.5);
  });

  it("leaves an ellipsis alone rather than a blank box", () => {
    const el = box(text);
    el.style.fontSize = "16px";
    clipTextToBox(el, 1, text);
    expect(el.firstChild!.nodeValue).toBe("…");
  });

  it("writes through the node the renderer put there", () => {
    const el = box(text);
    const node = el.firstChild;
    el.style.fontSize = "16px";
    clipTextToBox(el, 60, text);
    expect(el.firstChild).toBe(node);
    expect(el.childNodes).toHaveLength(1);
  });

  it("does nothing to a box whose first child is not text", () => {
    const el = document.createElement("div");
    el.innerHTML = "<span>Supper</span>";
    document.body.appendChild(el);
    expect(() => clipTextToBox(el, 10, "Supper")).not.toThrow();
    expect(el.innerHTML).toBe("<span>Supper</span>");
  });
});

describe("textOverflowsWidth", () => {
  const sized = (scrollWidth: number, clientWidth: number) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollWidth", { value: scrollWidth });
    Object.defineProperty(el, "clientWidth", { value: clientWidth });
    return el;
  };

  it("catches a word wider than its line", () => {
    expect(textOverflowsWidth(sized(140, 100))).toBe(true);
  });

  it("forgives sub-pixel rounding", () => {
    expect(textOverflowsWidth(sized(100.4, 100))).toBe(false);
    expect(textOverflowsWidth(sized(100, 100))).toBe(false);
  });
});

describe("textSlotHeight", () => {
  it("is zero for a box with no slot around it", () => {
    expect(textSlotHeight(document.createElement("div"))).toBe(0);
  });

  it("is what is left of the slot from where the text starts", () => {
    const slot = document.createElement("div");
    const el = document.createElement("div");
    slot.appendChild(el);
    document.body.appendChild(slot);
    Object.defineProperty(slot, "clientHeight", { value: 100 });
    Object.defineProperty(slot, "clientTop", { value: 0 });
    slot.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    // The text begins 30 px down — under a heading, say.
    el.getBoundingClientRect = () => ({ top: 30 }) as DOMRect;
    expect(textSlotHeight(el)).toBe(70);
  });

  it("never goes negative", () => {
    const slot = document.createElement("div");
    const el = document.createElement("div");
    slot.appendChild(el);
    Object.defineProperty(slot, "clientHeight", { value: 20 });
    Object.defineProperty(slot, "clientTop", { value: 0 });
    slot.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    el.getBoundingClientRect = () => ({ top: 90 }) as DOMRect;
    expect(textSlotHeight(el)).toBe(0);
  });
});
