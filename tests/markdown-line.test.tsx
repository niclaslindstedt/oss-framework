// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { classifyLines, RenderedLine } from "../src/markdown/index.ts";

// Render a single source line's formatted markup and return its container.
function renderLine(source: string) {
  const block = classifyLines(source)[0]!;
  const { container } = render(<RenderedLine block={block} />);
  return container.firstElementChild as HTMLElement;
}

// The list marker glyph is the aria-hidden span the renderer draws to the left.
function marker(source: string): string {
  const el = renderLine(source).querySelector('[aria-hidden="true"]');
  return el?.textContent ?? "";
}

describe("bullet markers by depth", () => {
  it("cycles •, –, + as the item nests", () => {
    expect(marker("- top")).toBe("•");
    expect(marker("  - sub")).toBe("–");
    expect(marker("    - deep")).toBe("+");
  });

  it("wraps back to • past the third level", () => {
    expect(marker("      - deeper")).toBe("•");
  });
});

describe("ordered markers by depth", () => {
  it("keeps decimal at the top level", () => {
    expect(marker("3. top")).toBe("3.");
  });

  it("switches to lower-alpha one level in", () => {
    expect(marker("  3. sub")).toBe("c.");
  });

  it("switches to lower-roman two levels in", () => {
    expect(marker("    4. deep")).toBe("iv.");
  });

  it("preserves the source separator", () => {
    expect(marker("  2) sub")).toBe("b)");
  });
});

describe("indentation", () => {
  it("indents nested items and leaves the top level flush", () => {
    expect(renderLine("- top").style.marginLeft).toBe("");
    expect(renderLine("  - sub").style.marginLeft).toBe("1.25rem");
    expect(renderLine("    - deep").style.marginLeft).toBe("2.5rem");
  });
});
