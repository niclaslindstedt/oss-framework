// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRESET_PALETTES, ThemePreview, THEMES } from "../src/theme/index.ts";

describe("ThemePreview", () => {
  it("renders a palette into inline styles without depending on applied CSS", () => {
    const { container } = render(
      <ThemePreview colors={PRESET_PALETTES.tokyoNight} />,
    );
    const root = container.firstElementChild as HTMLElement;
    // Self-contained: the palette's pageBg paints the card background inline,
    // so the preview renders the same regardless of the active theme. (jsdom
    // normalises the hex to rgb — #16161e → rgb(22, 22, 30).)
    expect(root.style.background).toBe("rgb(22, 22, 30)");
    // Decorative — carries no accessible name of its own.
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders every preset palette", () => {
    for (const t of THEMES) {
      if (t === "system" || t === "custom") continue;
      expect(() =>
        render(<ThemePreview colors={PRESET_PALETTES[t]} />),
      ).not.toThrow();
    }
  });
});
