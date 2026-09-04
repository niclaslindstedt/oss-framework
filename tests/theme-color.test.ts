// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  syncThemeColor,
  watchSystemThemeColor,
} from "../src/theme/theme-color.ts";

function head(html: string): void {
  document.head.innerHTML = html;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.documentElement.style.removeProperty("--page-bg");
});

const metas = () =>
  [...document.head.querySelectorAll<HTMLMetaElement>("meta")].map(
    (m) => m.content,
  );

describe("syncThemeColor", () => {
  it("writes the resolved page background to every theme-color meta", () => {
    head(
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />' +
        '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />',
    );
    document.documentElement.style.setProperty("--page-bg", "#123456");
    syncThemeColor();
    expect(metas()).toEqual(["#123456", "#123456"]);
  });

  it("leaves other metas alone", () => {
    head(
      '<meta name="theme-color" content="#ffffff" />' +
        '<meta name="description" content="a description" />',
    );
    document.documentElement.style.setProperty("--page-bg", "#abcdef");
    syncThemeColor();
    expect(metas()).toEqual(["#abcdef", "a description"]);
  });

  it("falls back to the light paper default when nothing is resolved", () => {
    head('<meta name="theme-color" content="#ffffff" />');
    syncThemeColor();
    expect(metas()).toEqual(["#f6f8fa"]);
  });

  it("is a no-op with no meta to write", () => {
    expect(() => syncThemeColor()).not.toThrow();
  });
});

describe("watchSystemThemeColor", () => {
  it("re-syncs on a light/dark flip and detaches on teardown", () => {
    const listeners: (() => void)[] = [];
    const addEventListener = vi.fn((_: string, fn: () => void) =>
      listeners.push(fn),
    );
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener,
      removeEventListener,
    }));
    vi.stubGlobal("matchMedia", matchMedia);

    head('<meta name="theme-color" content="#ffffff" />');
    document.documentElement.style.setProperty("--page-bg", "#101010");
    const stop = watchSystemThemeColor();
    expect(addEventListener).toHaveBeenCalledTimes(1);

    listeners[0]!();
    expect(metas()).toEqual(["#101010"]);

    stop();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
