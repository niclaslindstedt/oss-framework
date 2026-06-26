// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ColorPalette,
  DEFAULT_GLYPH,
  GLYPH_COLORS,
  GLYPH_NAMES,
  GLYPH_PATHS,
  Glyph,
  GlyphPicker,
  glyphDataUri,
  glyphSvg,
  isGlyphName,
} from "../src/glyphs/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// --- catalogue ------------------------------------------------------------

describe("catalogue", () => {
  it("offers every name it can draw, default excluded", () => {
    // GLYPH_NAMES is the picker's offered set; every entry must be drawable.
    for (const name of GLYPH_NAMES) expect(GLYPH_PATHS[name]).toBeTruthy();
    // The default glyph is drawable but not offered (the clear cell stands for it).
    expect(GLYPH_PATHS[DEFAULT_GLYPH]).toBeTruthy();
    expect(GLYPH_NAMES).not.toContain(DEFAULT_GLYPH);
  });

  it("carries the converged superset (notes' `pen` + checklist's `cart`/`car`/`wallet`)", () => {
    for (const name of ["pen", "cart", "car", "wallet", "folder"])
      expect(name in GLYPH_PATHS).toBe(true);
  });

  it("isGlyphName narrows known names and rejects the rest", () => {
    expect(isGlyphName("home")).toBe(true);
    expect(isGlyphName("nope")).toBe(false);
    expect(isGlyphName(undefined)).toBe(false);
  });
});

// --- favicon builders -----------------------------------------------------

describe("glyphSvg / glyphDataUri", () => {
  it("strokes the named glyph in the given colour", () => {
    const svg = glyphSvg("home", "#61afef");
    expect(svg).toContain(GLYPH_PATHS.home);
    expect(svg).toContain('stroke="#61afef"');
    // Transparent badge by default — no background rect.
    expect(svg).not.toContain("<rect");
  });

  it("paints a filled badge when a background is given", () => {
    const svg = glyphSvg("star", "#fff", { background: "#1f2933", size: 64 });
    expect(svg).toContain('<rect width="64" height="64"');
    expect(svg).toContain('fill="#1f2933"');
  });

  it("falls back to the default glyph for an unknown name", () => {
    expect(glyphSvg("does-not-exist", "#000")).toContain(
      GLYPH_PATHS[DEFAULT_GLYPH],
    );
  });

  it("data URI is an encoded image/svg+xml of the same SVG", () => {
    const uri = glyphDataUri("leaf", "#98c379");
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(uri.slice("data:image/svg+xml,".length))).toBe(
      glyphSvg("leaf", "#98c379"),
    );
  });
});

// --- Glyph ----------------------------------------------------------------

describe("Glyph", () => {
  // jsdom re-serialises self-closing `<path/>` as `<path></path>`, so compare
  // by the path `d` data rather than the raw inner markup string.
  const pathData = (markup: string) =>
    [...markup.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const renderedPathData = (container: HTMLElement) =>
    [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));

  it("renders the named glyph's markup", () => {
    const { container } = render(<Glyph name="heart" />);
    expect(renderedPathData(container)).toEqual(pathData(GLYPH_PATHS.heart!));
  });

  it("falls back to the default glyph for an unknown / missing name", () => {
    const { container } = render(<Glyph name="bogus" />);
    expect(renderedPathData(container)).toEqual(
      pathData(GLYPH_PATHS[DEFAULT_GLYPH]!),
    );
  });
});

// --- GlyphPicker ----------------------------------------------------------

describe("GlyphPicker", () => {
  it("checks the selected glyph and clears via the leading cell", () => {
    const onChange = vi.fn();
    render(
      <GlyphPicker
        glyphs={GLYPH_NAMES}
        value="home"
        onChange={onChange}
        noneLabel="No icon"
        ariaLabelPrefix="Icon"
      />,
    );
    // The "home" cell reads as the checked radio.
    expect(
      screen
        .getByRole("radio", { name: "Icon home" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    // Picking a different glyph reports it.
    fireEvent.click(screen.getByRole("radio", { name: "Icon star" }));
    expect(onChange).toHaveBeenCalledWith("star");
    // The leading cell clears to the default (null).
    fireEvent.click(screen.getByRole("radio", { name: "No icon" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("tints the selected cell with the accent colour", () => {
    render(
      <GlyphPicker
        glyphs={GLYPH_NAMES}
        value="star"
        onChange={() => {}}
        tintColor="#e06c75"
        noneLabel="No icon"
        ariaLabelPrefix="Icon"
      />,
    );
    const cell = screen.getByRole("radio", { name: "Icon star" });
    expect(cell.style.color).toBe("rgb(224, 108, 117)");
  });
});

// --- ColorPalette ---------------------------------------------------------

describe("ColorPalette", () => {
  it("marks the chosen swatch and reports a pick", () => {
    const onChange = vi.fn();
    render(
      <ColorPalette
        colors={GLYPH_COLORS}
        value={GLYPH_COLORS[3]!}
        onChange={onChange}
        ariaLabelPrefix="Colour"
      />,
    );
    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(GLYPH_COLORS.length);
    expect(swatches[3]!.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(swatches[0]!);
    expect(onChange).toHaveBeenCalledWith(GLYPH_COLORS[0]);
  });
});
