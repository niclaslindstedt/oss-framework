// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  PRESET_TOKENS_BY_THEME,
  PRESET_TOKENS_CSS,
  THEMES,
  installPresetTokens,
} from "../src/theme/index.ts";

afterEach(() => {
  document
    .querySelectorAll("style[data-oss-framework-presets]")
    .forEach((el) => el.remove());
});

describe("PRESET_TOKENS_BY_THEME", () => {
  it("carries a block for every theme the picker can offer", () => {
    // `custom` needs no block — the engine writes its colours inline on <html>.
    const needed = THEMES.filter((t) => t !== "custom");
    for (const theme of needed) {
      expect(PRESET_TOKENS_BY_THEME[theme], theme).toBeDefined();
    }
  });

  it("scopes each block to its own data-theme and nothing else", () => {
    for (const [theme, block] of Object.entries(PRESET_TOKENS_BY_THEME)) {
      const scopes = [...block.matchAll(/data-theme="([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(new Set(scopes), theme).toEqual(new Set([theme]));
    }
  });

  it("adds up to the everything bundle", () => {
    expect(PRESET_TOKENS_CSS).toBe(
      Object.values(PRESET_TOKENS_BY_THEME).join("\n\n"),
    );
  });
});

describe("installPresetTokens", () => {
  const injected = () =>
    document.querySelector("style[data-oss-framework-presets]")?.textContent ??
    "";

  it("injects every theme by default", () => {
    installPresetTokens();
    expect(injected()).toBe(PRESET_TOKENS_CSS);
  });

  it("injects only the themes an app offers", () => {
    installPresetTokens(["nord", "dracula"]);
    const css = injected();
    expect(css).toContain('data-theme="nord"');
    expect(css).toContain('data-theme="dracula"');
    expect(css).not.toContain('data-theme="gruvbox"');
    expect(css.length).toBeLessThan(PRESET_TOKENS_CSS.length);
  });

  it("skips a name it has no block for rather than throwing", () => {
    installPresetTokens(["nord", "not-a-theme"]);
    expect(injected()).toBe(PRESET_TOKENS_BY_THEME.nord);
  });

  it("is idempotent", () => {
    installPresetTokens(["nord"]);
    installPresetTokens(["dracula"]);
    expect(
      document.querySelectorAll("style[data-oss-framework-presets]"),
    ).toHaveLength(1);
    expect(injected()).toBe(PRESET_TOKENS_BY_THEME.nord);
  });
});
