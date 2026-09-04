// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  displayModeOf,
  formatInsets,
  INSET_PROBE_PADDING,
  pxOf,
  readSafeAreaInsets,
  readViewportReport,
  resolveCssLength,
} from "../src/pwa/viewport.ts";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("pxOf", () => {
  it("reads a computed px length", () => {
    expect(pxOf("12.5px")).toBe(12.5);
    expect(pxOf("0px")).toBe(0);
  });

  it("reads nothing as zero", () => {
    expect(pxOf("")).toBe(0);
    expect(pxOf("auto")).toBe(0);
  });
});

describe("formatInsets", () => {
  it("prints top / right / bottom / left in whole pixels", () => {
    expect(formatInsets({ top: 59.4, right: 0, bottom: 34, left: 0.2 })).toBe(
      "59 / 0 / 34 / 0",
    );
  });
});

describe("displayModeOf", () => {
  it("names the first mode that matches", () => {
    expect(displayModeOf((q) => q === "(display-mode: standalone)")).toBe(
      "standalone",
    );
    expect(displayModeOf((q) => q === "(display-mode: browser)")).toBe(
      "browser",
    );
  });

  it("prefers the more specific mode when several match", () => {
    // A browser that reports both gets the one that changes the layout.
    expect(displayModeOf(() => true)).toBe("standalone");
  });

  it("reports an unrecognised environment rather than guessing", () => {
    expect(displayModeOf(() => false)).toBe("unknown");
  });

  it("takes a caller's own mode list", () => {
    expect(
      displayModeOf(
        (q) => q === "(display-mode: window-controls-overlay)",
        ["window-controls-overlay"],
      ),
    ).toBe("window-controls-overlay");
  });
});

describe("the inset probe", () => {
  it("asks for all four insets in one shorthand", () => {
    expect(INSET_PROBE_PADDING).toContain("safe-area-inset-top");
    expect(INSET_PROBE_PADDING).toContain("safe-area-inset-right");
    expect(INSET_PROBE_PADDING).toContain("safe-area-inset-bottom");
    expect(INSET_PROBE_PADDING).toContain("safe-area-inset-left");
  });

  it("cleans up after itself", () => {
    readSafeAreaInsets();
    expect(document.body.children).toHaveLength(0);
  });

  it("reads zeroes where the engine resolves nothing", () => {
    // jsdom computes no `env()`, which is exactly the browser-tab answer.
    expect(readSafeAreaInsets()).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("resolveCssLength", () => {
  it("resolves an expression rather than echoing it, and cleans up", () => {
    expect(resolveCssLength("24px")).toBe(24);
    expect(document.body.children).toHaveLength(0);
  });

  it("reads an expression that does not compute as zero", () => {
    expect(resolveCssLength("var(--nothing-here)")).toBe(0);
  });
});

describe("readViewportReport", () => {
  it("reports the window's size, its insets and its display mode", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(display-mode: browser)",
    }));
    const report = readViewportReport();
    expect(report).not.toBeNull();
    expect(report!.width).toBe(window.innerWidth);
    expect(report!.height).toBe(window.innerHeight);
    expect(report!.displayMode).toBe("browser");
    expect(report!.insets.top).toBe(0);
  });
});
