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

  // A caller-supplied catalogue — bare inner-SVG markup keyed by name, the
  // same shape as GLYPH_PATHS.
  const CUSTOM_PATHS: Record<string, string> = {
    wave: '<path d="M2 12h20"/>',
    ring: '<path d="M12 3a9 9 0 1 0 0 18"/>',
  };

  it("draws from a caller-supplied path table", () => {
    const { container } = render(<Glyph name="wave" paths={CUSTOM_PATHS} />);
    expect(renderedPathData(container)).toEqual(pathData(CUSTOM_PATHS.wave!));
  });

  it("renders the fallback node when the name misses the active table", () => {
    const { container } = render(
      <Glyph
        name="bogus"
        paths={CUSTOM_PATHS}
        fallback={<span data-testid="custom-fallback">person</span>}
      />,
    );
    expect(
      container.querySelector('[data-testid="custom-fallback"]'),
    ).not.toBeNull();
    // The fallback replaces the SVG shell entirely — the caller's node is
    // rendered as-is.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("still draws the built-in default on a miss when no fallback is given", () => {
    const { container } = render(<Glyph name="bogus" paths={CUSTOM_PATHS} />);
    expect(renderedPathData(container)).toEqual(
      pathData(GLYPH_PATHS[DEFAULT_GLYPH]!),
    );
  });

  it("ignores the fallback when the name resolves", () => {
    const { container } = render(
      <Glyph
        name="ring"
        paths={CUSTOM_PATHS}
        fallback={<span data-testid="custom-fallback" />}
      />,
    );
    expect(
      container.querySelector('[data-testid="custom-fallback"]'),
    ).toBeNull();
    expect(renderedPathData(container)).toEqual(pathData(CUSTOM_PATHS.ring!));
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

  it("draws a caller-supplied default icon in the clear cell", () => {
    render(
      <GlyphPicker
        glyphs={GLYPH_NAMES}
        value={null}
        onChange={() => {}}
        noneLabel="No icon"
        ariaLabelPrefix="Icon"
        defaultIcon={<span data-testid="kind-default">note</span>}
      />,
    );
    const clear = screen.getByRole("radio", { name: "No icon" });
    expect(clear.querySelector('[data-testid="kind-default"]')).not.toBeNull();
  });

  it("threads a caller-supplied path table to every cell", () => {
    const CUSTOM_PATHS: Record<string, string> = {
      wave: '<path d="M2 12h20"/>',
      ring: '<path d="M12 3a9 9 0 1 0 0 18"/>',
    };
    render(
      <GlyphPicker
        glyphs={["wave", "ring"]}
        value={null}
        onChange={() => {}}
        noneLabel="No icon"
        ariaLabelPrefix="Icon"
        paths={CUSTOM_PATHS}
      />,
    );
    // Each named cell draws its glyph from the custom table.
    const wave = screen.getByRole("radio", { name: "Icon wave" });
    expect(wave.querySelector("path")?.getAttribute("d")).toBe("M2 12h20");
    // With no `defaultIcon`, the clear cell still renders something sensible:
    // the custom table carries no default glyph, so the cell's Glyph falls
    // back to the built-in DEFAULT_GLYPH mark.
    const clear = screen.getByRole("radio", { name: "No icon" });
    const clearD = [...clear.querySelectorAll("path")].map((p) =>
      p.getAttribute("d"),
    );
    expect(clearD).toEqual(
      [...GLYPH_PATHS[DEFAULT_GLYPH]!.matchAll(/d="([^"]*)"/g)].map(
        (m) => m[1],
      ),
    );
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
