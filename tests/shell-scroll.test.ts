// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { driftPx, pinShellScroll, shouldPin } from "../src/pwa/shellScroll.ts";

describe("driftPx", () => {
  it("takes whichever of the two ways the engine expressed it is larger", () => {
    expect(driftPx(0, 0)).toBe(0);
    expect(driftPx(120, 0)).toBe(120);
    expect(driftPx(0, 88)).toBe(88);
    expect(driftPx(40, 88)).toBe(88);
  });
});

describe("shouldPin", () => {
  it("pins a real drift", () => {
    expect(shouldPin(120, false)).toBe(true);
    expect(shouldPin(1, false)).toBe(true);
  });

  it("leaves sub-pixel rounding alone", () => {
    expect(shouldPin(0, false)).toBe(false);
    expect(shouldPin(0.5, false)).toBe(false);
  });

  it("never fights the keyboard while a field has focus", () => {
    expect(shouldPin(120, true)).toBe(false);
  });
});

describe("pinShellScroll", () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const drift = (px: number) =>
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: px,
    });

  it("puts a drifted shell back, a beat after the event", () => {
    const stop = pinShellScroll();
    drift(140);
    window.dispatchEvent(new Event("focusout"));
    expect(scrollTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    stop();
  });

  it("leaves an undrifted shell alone", () => {
    const stop = pinShellScroll();
    drift(0);
    window.dispatchEvent(new Event("focusout"));
    vi.advanceTimersByTime(300);
    expect(scrollTo).not.toHaveBeenCalled();
    stop();
  });

  it("stands down while a field is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const stop = pinShellScroll();
    drift(140);
    window.dispatchEvent(new Event("orientationchange"));
    vi.advanceTimersByTime(300);
    expect(scrollTo).not.toHaveBeenCalled();
    stop();
  });

  it("coalesces a burst of events into one check", () => {
    const stop = pinShellScroll();
    drift(140);
    window.dispatchEvent(new Event("focusout"));
    window.dispatchEvent(new Event("focusout"));
    window.dispatchEvent(new Event("pageshow"));
    vi.advanceTimersByTime(300);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops listening once torn down", () => {
    const stop = pinShellScroll();
    stop();
    drift(140);
    window.dispatchEvent(new Event("focusout"));
    vi.advanceTimersByTime(300);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
