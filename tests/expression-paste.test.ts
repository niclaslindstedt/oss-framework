// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { pasteLabel, pasteCandidate } from "../src/expression/index.ts";

// What the display would end up with, or null when the clipboard has nothing
// to offer — the paste half of the clipboard bar hangs off exactly this.
function paste(clipboard: string): string | null {
  return pasteCandidate(clipboard)?.text ?? null;
}

describe("pasteCandidate", () => {
  it("takes text the grammar already understands, verbatim", () => {
    expect(pasteCandidate("1+2")).toEqual({ text: "1+2", kind: "expression" });
    expect(pasteCandidate("12×4.5")).toEqual({
      text: "12×4.5",
      kind: "expression",
    });
    expect(pasteCandidate("sqrt(16)")).toEqual({
      text: "sqrt(16)",
      kind: "expression",
    });
    // A product written the way it is on paper is inside the grammar too, so
    // it comes over whole rather than giving up its first number.
    expect(pasteCandidate("2(3+4)")).toEqual({
      text: "2(3+4)",
      kind: "expression",
    });
    expect(pasteCandidate("0xFF")).toEqual({
      text: "0xFF",
      kind: "expression",
    });
  });

  it("drops the whitespace copied text arrives wrapped in", () => {
    expect(paste("  42\n")).toBe("42");
    expect(paste("12 × 4.5")).toBe("12×4.5");
  });

  it("keeps a value copied off the tape byte for byte", () => {
    // The app's own decimal separator is `.`, so a lone dot is never read as
    // a thousands separator — a copied result has to paste back as itself.
    expect(pasteCandidate("1.234")).toEqual({
      text: "1.234",
      kind: "expression",
    });
    expect(paste("-0.5")).toBe("-0.5");
  });

  it("salvages the number out of text it cannot parse", () => {
    expect(pasteCandidate("Total: $1,234.56")).toEqual({
      text: "1234.56",
      kind: "number",
    });
    expect(paste("50%")).toBe("50");
    expect(paste("It cost 42.")).toBe("42");
    expect(paste("-5 degrees")).toBe("-5");
  });

  it("reads thousands separators whichever way the locale writes them", () => {
    expect(paste("1.234,56 kr")).toBe("1234.56");
    expect(paste("1,234.56 usd")).toBe("1234.56");
    expect(paste("1 234,56 kr")).toBe("1234.56");
    expect(paste("1'234.5 chf")).toBe("1234.5");
    expect(paste("1.234.567 kr")).toBe("1234567");
    expect(paste("12,5 kr")).toBe("12.5");
  });

  it("never reads a leading zero as a thousands group", () => {
    // …and pastes the digits as copied rather than tidying them away: the
    // trailing zeros are the source's precision, not noise.
    expect(paste("0,500 kr")).toBe("0.500");
  });

  it("offers nothing when there is no number in the clipboard", () => {
    expect(pasteCandidate("")).toBeNull();
    expect(pasteCandidate("   \n ")).toBeNull();
    expect(pasteCandidate("hello there")).toBeNull();
  });
});

describe("pasteLabel", () => {
  it("shows short text as it is", () => {
    expect(pasteLabel("1234.56")).toBe("1234.56");
  });

  it("cuts text no button could honestly show", () => {
    expect(pasteLabel("123456789012345678901234567890")).toBe(
      "12345678901234567…",
    );
  });
});
