// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  evaluate,
  expressionSegments,
  depthClass,
  toggleSign,
} from "../src/expression/index.ts";

// Shorthand: the reading, with chipped operators bracketed. Segments that draw
// something other than what they store (`sqrt` → `√`) report the glyph, so the
// string is what the tape shows rather than what the file holds.
function read(text: string): string {
  return expressionSegments(text)
    .map((s) => (s.op ? `[${s.text}]` : (s.display ?? s.text)))
    .join("");
}

// The same reading as depths, one digit per character of the source.
function depths(text: string): string {
  return expressionSegments(text)
    .map((s) => String(s.depth).repeat(s.text.length))
    .join("");
}

describe("expressionSegments", () => {
  it("lifts binary operators out of their operands", () => {
    expect(read("1+2")).toBe("1[+]2");
    expect(read("25+95+13")).toBe("25[+]95[+]13");
    expect(read("6×7÷2")).toBe("6[×]7[÷]2");
    expect(read("10%3^2")).toBe("10[%]3[^]2");
  });

  it("keeps a leading sign welded to its number", () => {
    expect(read("-5")).toBe("-5");
    expect(read("−5+1")).toBe("−5[+]1");
    expect(read("1--2")).toBe("1[-]-2");
    expect(read("2^-1")).toBe("2[^]-1");
    expect(read("(-5)")).toBe("(-5)");
    expect(read("~5")).toBe("~5");
    expect(read("1&~2")).toBe("1[&]~2");
  });

  it("leaves brackets, functions and literals plain", () => {
    expect(read("sin(30)")).toBe("sin(30)");
    expect(read("0x1F")).toBe("0x1F");
    expect(read("(1+2)×3")).toBe("(1[+]2)[×]3");
  });

  it("sets a symbol function as its symbol, bracket and all left in place", () => {
    expect(read("sqrt(9)")).toBe("√(9)");
    expect(read("1+sqrt(9)")).toBe("1[+]√(9)");
    expect(read("sqrt(2)×sqrt(8)")).toBe("√(2)[×]√(8)");
    // The argument still reads as an argument: a sign inside the call is a
    // sign, not a subtraction with a missing left half.
    expect(read("sqrt(-4)")).toBe("√(-4)");
  });

  it("only symbolises a name that is calling something", () => {
    // No bracket: not a call, so nothing is replaced.
    expect(read("sqrt")).toBe("sqrt");
    expect(read("sqrt+1")).toBe("sqrt[+]1");
    // Part of a longer name, or of a literal.
    expect(read("mysqrt(9)")).toBe("mysqrt(9)");
    expect(read("0xsqrt(9)")).toBe("0xsqrt(9)");
  });

  it("keeps the source text under the symbol it draws", () => {
    const segments = expressionSegments("1+sqrt(9)");
    const fn = segments.find((s) => s.display !== undefined);
    expect(fn).toEqual({
      start: 2,
      text: "sqrt",
      op: false,
      depth: 0,
      display: "√",
    });
    expect(segments.map((s) => s.text).join("")).toBe("1+sqrt(9)");
  });

  it("chips the two-character and word operators whole", () => {
    expect(read("1<<8")).toBe("1[<<]8");
    expect(read("64>>2")).toBe("64[>>]2");
    expect(read("5 xor 3")).toBe("5 [xor] 3");
  });

  it("chips a postfix factorial without expecting an operand after it", () => {
    expect(read("5!")).toBe("5[!]");
    expect(read("5!-3")).toBe("5[!][-]3");
  });

  it("keeps whitespace with the run it sits in", () => {
    expect(read("1 + 2")).toBe("1 [+] 2");
  });

  it("reproduces the input exactly, with the right offsets", () => {
    for (const text of [
      "",
      "1+2",
      "-5×(3-1)",
      "5 xor 3!",
      "sin(π)÷2",
      "((1+2)×(3-4))",
      "sqrt(9)+sqrt(16)",
    ]) {
      const segments = expressionSegments(text);
      expect(segments.map((s) => s.text).join("")).toBe(text);
      for (const segment of segments) {
        expect(
          text.slice(segment.start, segment.start + segment.text.length),
        ).toBe(segment.text);
      }
    }
  });
});

describe("bracket depth", () => {
  it("counts a bracket with what it holds, not with what surrounds it", () => {
    expect(depths("1+2")).toBe("000");
    expect(depths("(1+2)")).toBe("11111");
    expect(depths("2×(3+1)")).toBe("0011111");
    // The name in front of a call stays outside — it is not inside the
    // brackets, the argument is. A symbol function is a name like any other:
    // the `√` colours with what surrounds the call, its argument with the
    // brackets holding it.
    expect(depths("sin(30)")).toBe("0001111");
    expect(depths("sqrt(9)")).toBe("0000111");
    expect(depths("(1+sqrt(4))")).toBe("11111112221");
  });

  it("steps a level for every nested group", () => {
    expect(depths("((1))")).toBe("12221");
    expect(depths("1+(2×(3-(4+5)))")).toBe("001112223333321");
    // Siblings, not nesting: the second group is back at the first's level.
    expect(depths("(1+2)×(3-4)")).toBe("11111011111");
  });

  it("holds the floor when a bracket closes one that never opened", () => {
    expect(depths(")1")).toBe("00");
    expect(depths("(1))+2")).toBe("111000");
  });

  it("colours three levels and then starts over", () => {
    expect(depthClass(0)).toBe("");
    expect(depthClass(1)).toBe("oss-expr-depth-1");
    expect(depthClass(2)).toBe("oss-expr-depth-2");
    expect(depthClass(3)).toBe("oss-expr-depth-3");
    // Deeper than the app ever draws, but a colour beats no colour — and the
    // one it repeats is never the group's own parent.
    expect(depthClass(4)).toBe("oss-expr-depth-1");
  });
});

describe("toggleSign", () => {
  it("signs the number the display ends on, and unsigns it again", () => {
    expect(toggleSign("34")).toBe("−34");
    expect(toggleSign("−34")).toBe("34");
    expect(toggleSign("12+34")).toBe("12+−34");
    expect(toggleSign("12+−34")).toBe("12+34");
    expect(toggleSign("12.5")).toBe("−12.5");
  });

  it("leaves a subtraction alone", () => {
    // The `−` in `1−34` has an operand on its left, so it is the operator —
    // signing 34 gives `1−−34`, and taking the sign back restores the sum.
    expect(toggleSign("1−34")).toBe("1−−34");
    expect(toggleSign("1−−34")).toBe("1−34");
  });

  it("takes a bracketed value, a call and a literal whole", () => {
    expect(toggleSign("sqrt(9)")).toBe("−sqrt(9)");
    expect(toggleSign("1+sqrt(9)")).toBe("1+−sqrt(9)");
    expect(toggleSign("1+−sqrt(9)")).toBe("1+sqrt(9)");
    expect(toggleSign("2×(3+4)")).toBe("2×−(3+4)");
    expect(toggleSign("0x1F")).toBe("−0x1F");
    expect(toggleSign("π")).toBe("−π");
    expect(toggleSign("5!")).toBe("−5!");
  });

  it("signs the number being typed inside a bracket", () => {
    expect(toggleSign("sqrt(9")).toBe("sqrt(−9");
    expect(toggleSign("sqrt(−9")).toBe("sqrt(9");
  });

  it("puts the sign down on its own when there is no value yet", () => {
    expect(toggleSign("")).toBe("−");
    expect(toggleSign("−")).toBe("");
    expect(toggleSign("12+")).toBe("12+−");
    expect(toggleSign("12+−")).toBe("12+");
    expect(toggleSign("(")).toBe("(−");
  });

  it("writes what the evaluator and the display both read back", () => {
    expect(evaluate(toggleSign("12+34"))).toBe(-22);
    expect(evaluate(toggleSign("34"))).toBe(-34);
    expect(evaluate(toggleSign("1+sqrt(9)"))).toBe(-2);
    // A sign stays welded to its number rather than reading as an operation.
    expect(read(toggleSign("12+34"))).toBe("12[+]−34");
  });
});
