// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpressionText, RevealText } from "../src/expression/index.ts";

describe("ExpressionText", () => {
  it("chips the operators and leaves the values plain", () => {
    const { container } = render(<ExpressionText text="12+34" />);
    const chips = [...container.querySelectorAll(".oss-expr-op")];
    expect(chips.map((c) => c.textContent)).toEqual(["+"]);
    expect(container.textContent).toBe("12+34");
  });

  it("sets a symbol function as its glyph but keeps the source intact", () => {
    const { container } = render(<ExpressionText text="sqrt(9)" />);
    expect(container.querySelector(".oss-expr-fn")?.textContent).toBe("√");
    expect(container.textContent).toBe("√(9)");
  });

  it("takes the caller's own symbol map", () => {
    const { container } = render(
      <ExpressionText text="cbrt(8)" symbols={{ cbrt: "∛" }} />,
    );
    expect(container.querySelector(".oss-expr-fn")?.textContent).toBe("∛");
  });

  it("colours each bracket depth, and everything the group holds", () => {
    const { container } = render(<ExpressionText text="1×(2+(3−4))" />);
    // The outer group's own bracket, and the chip inside it, share a colour.
    expect(container.querySelectorAll(".oss-expr-depth-1").length).toBe(4);
    expect(container.querySelectorAll(".oss-expr-depth-2").length).toBe(5);
    // The `×` out in the open takes no depth colour at all.
    const openChip = container.querySelector(".oss-expr-op");
    expect(openChip?.className).toBe("oss-expr-op ");
  });
});

describe("RevealText", () => {
  it("gives every character its own animated span, with a stagger", () => {
    const { container } = render(<RevealText text="123" />);
    const chars = [...container.querySelectorAll(".oss-expr-char")];
    expect(chars.map((c) => c.textContent)).toEqual(["1", "2", "3"]);
    expect(chars.map((c) => (c as HTMLElement).style.animationDelay)).toEqual([
      "0ms",
      "22ms",
      "44ms",
    ]);
  });

  it("reveals an operator whole rather than character by character", () => {
    const { container } = render(<RevealText text="1<<2" />);
    const chip = container.querySelector(".oss-expr-op");
    expect(chip?.textContent).toBe("<<");
  });

  it("leaves already-shown characters alone when text is appended", () => {
    const { container, rerender } = render(<RevealText text="12" />);
    rerender(<RevealText text="123" />);
    const chars = [...container.querySelectorAll(".oss-expr-char")];
    // The two that were already on screen keep the delays they landed with;
    // only the new tail is staggered from zero again.
    expect(chars.map((c) => (c as HTMLElement).style.animationDelay)).toEqual([
      "0ms",
      "22ms",
      "0ms",
    ]);
  });

  it("spells the whole string out for a screen reader", () => {
    const { container } = render(<RevealText text="1+2" />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("1+2");
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
