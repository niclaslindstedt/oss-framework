// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COLOR_KEYS,
  COLOR_KEY_TO_CSS_VAR,
  PRESET_PALETTES,
  PRESET_TOKENS_CSS,
  installPresetTokens,
} from "../src/theme/index.ts";

// Vitest runs from the repo root, so resolve the stylesheet relative to cwd.
const frameworkCss = readFileSync("src/theme/framework.css", "utf8");

describe("PRESET_TOKENS_CSS", () => {
  it("emits a [data-theme] block for every built-in preset (no drift)", () => {
    for (const preset of Object.keys(PRESET_PALETTES)) {
      expect(PRESET_TOKENS_CSS).toContain(`:root[data-theme="${preset}"]`);
    }
  });

  it("emits a system block that follows the OS scheme", () => {
    expect(PRESET_TOKENS_CSS).toContain(`:root[data-theme="system"]`);
    expect(PRESET_TOKENS_CSS).toContain("prefers-color-scheme: light");
  });

  it("writes every colour slot with its canonical value", () => {
    const { githubDark } = PRESET_PALETTES;
    for (const key of COLOR_KEYS) {
      const slug = COLOR_KEY_TO_CSS_VAR[key];
      expect(PRESET_TOKENS_CSS).toContain(`--${slug}: ${githubDark[key]};`);
    }
  });

  it("does not emit a custom block (the engine writes those inline)", () => {
    expect(PRESET_TOKENS_CSS).not.toContain(`data-theme="custom"`);
  });
});

describe("installPresetTokens", () => {
  it("injects the preset blocks once and is idempotent", () => {
    installPresetTokens();
    installPresetTokens();
    const styles = document.head.querySelectorAll(
      "style[data-oss-framework-presets]",
    );
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(PRESET_TOKENS_CSS);
  });
});

describe("framework.css", () => {
  it("maps the Tailwind colour utilities to the slot variables", () => {
    expect(frameworkCss).toContain("@theme inline");
    expect(frameworkCss).toContain("--color-surface: var(--surface);");
    expect(frameworkCss).toContain("--color-accent: var(--accent);");
  });

  it("ships the flavour, elevation, and drawer-animation contracts", () => {
    expect(frameworkCss).toContain('[data-button-style="solid"]');
    expect(frameworkCss).toContain('[data-elevation="floating"]');
    expect(frameworkCss).toContain("@keyframes drawer-slide-in-left");
    expect(frameworkCss).toContain('[data-reduce-motion="true"]');
  });
});
