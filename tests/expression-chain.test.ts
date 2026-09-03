// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  chainExpression,
  evaluate,
  formatResult,
  topLevelPrecedence,
  type ChainStep,
} from "../src/expression/index.ts";

// Build a run from `expression` steps, chaining every step after the first
// unless it is written as a bare expression that does not continue the run.
function tape(steps: [expression: string, chained?: boolean][]): ChainStep[] {
  return steps.map(([expression, chained]) => {
    const step: ChainStep = {
      expression,
      result: formatResult(evaluate(expression)),
    };
    if (chained) step.chained = true;
    return step;
  });
}

describe("chainExpression", () => {
  it("folds a run into one expression, bracketing where precedence needs it", () => {
    const entries = tape([["1+2"], ["3*2", true]]);
    expect(chainExpression(entries, 1)).toBe("(1+2)*2");
  });

  it("leaves the first entry of a run alone", () => {
    const entries = tape([["1+2"], ["3*2", true]]);
    expect(chainExpression(entries, 0)).toBeNull();
  });

  it("returns null for an entry that starts its own run", () => {
    const entries = tape([["1+2"], ["4*2"]]);
    expect(chainExpression(entries, 1)).toBeNull();
  });

  it("keeps folding across a longer run", () => {
    const entries = tape([
      ["1+2"],
      ["3*2", true],
      ["6-1", true],
      ["5*3", true],
    ]);
    expect(chainExpression(entries, 3)).toBe("((1+2)*2-1)*3");
  });

  it("skips brackets when the inner expression already binds tighter", () => {
    const entries = tape([["2*3"], ["6+4", true]]);
    expect(chainExpression(entries, 1)).toBe("2*3+4");
  });

  it("skips brackets at equal precedence on the left of a left-associative operator", () => {
    const entries = tape([["1+2"], ["3+4", true]]);
    expect(chainExpression(entries, 1)).toBe("1+2+4");
  });

  it("brackets an equally-binding left operand of right-associative ^", () => {
    const entries = tape([["2^3"], ["8^2", true]]);
    expect(chainExpression(entries, 1)).toBe("(2^3)^2");
  });

  it("brackets a negative result rather than letting the sign detach", () => {
    const entries = tape([["0-2"], ["-2*3", true]]);
    expect(chainExpression(entries, 1)).toBe("(0-2)*3");
  });

  it("brackets before a postfix factorial", () => {
    const entries = tape([["1+2"], ["3!", true]]);
    expect(chainExpression(entries, 1)).toBe("(1+2)!");
  });

  it("brackets a loose expression before a bitwise operator", () => {
    const entries = tape([["1+2"], ["3 xor 5", true]]);
    expect(chainExpression(entries, 1)).toBe("1+2 xor 5");
  });

  it("does not bracket an already-parenthesized or function value", () => {
    const entries = tape([["sqrt(16)"], ["4*3", true]]);
    expect(chainExpression(entries, 1)).toBe("sqrt(16)*3");
  });

  it("folds a step that continued with a bracket rather than an operator", () => {
    const entries = tape([["1+2"], ["3(4)", true]]);
    expect(chainExpression(entries, 1)).toBe("(1+2)(4)");
  });

  it("folds a step that continued with a constant or a function", () => {
    expect(chainExpression(tape([["1+2"], ["3sqrt(4)", true]]), 1)).toBe(
      "(1+2)sqrt(4)",
    );
    expect(chainExpression(tape([["2*3"], ["6pi", true]]), 1)).toBe("2*3pi");
  });

  it("brackets an implicit product before a tighter operator", () => {
    const entries = tape([["2(3+4)"], ["14^2", true]]);
    expect(chainExpression(entries, 1)).toBe("(2(3+4))^2");
  });

  it("gives up when the stored text no longer starts with the previous result", () => {
    const entries = tape([["1+2"], ["9*2", true]]);
    expect(chainExpression(entries, 1)).toBeNull();
  });

  it("gives up when the previous result was typed into a longer number", () => {
    const entries: ChainStep[] = [
      { expression: "1+2", result: "3" },
      { expression: "35", result: "35", chained: true },
    ];
    expect(chainExpression(entries, 1)).toBeNull();
  });

  it("unwraps a chain step that only pressed = again", () => {
    const entries: ChainStep[] = [
      { expression: "1+2", result: "3" },
      { expression: "3", result: "3", chained: true },
    ];
    expect(chainExpression(entries, 1)).toBe("1+2");
  });

  it("folds to an expression with the same value as the step it replaces", () => {
    const runs: [string, boolean?][][] = [
      [["1+2"], ["3*2", true], ["6-1", true]],
      [["2*3"], ["6+4", true], ["10^2", true]],
      [["8/2"], ["4!", true]],
      [["0-2"], ["-2*3", true]],
      [["1+2"], ["3^2", true], ["9-1", true]],
      [["1+2"], ["3(4)", true], ["12+1", true]],
      [["2(3+4)"], ["14^2", true]],
    ];
    for (const steps of runs) {
      const entries = tape(steps);
      const last = entries.length - 1;
      const folded = chainExpression(entries, last);
      expect(folded).not.toBeNull();
      expect(formatResult(evaluate(folded as string))).toBe(
        entries[last]!.result,
      );
    }
  });
});

describe("topLevelPrecedence", () => {
  it("reports an atom for a value that never needs brackets", () => {
    expect(topLevelPrecedence("42")).toBe(10);
    expect(topLevelPrecedence("(1+2)")).toBe(10);
    expect(topLevelPrecedence("sqrt(1+2)")).toBe(10);
  });

  it("reports the loosest operator at the top level", () => {
    expect(topLevelPrecedence("1+2*3")).toBe(5);
    expect(topLevelPrecedence("2*3")).toBe(6);
    expect(topLevelPrecedence("(1+2)*3")).toBe(6);
  });

  it("tells a sign apart from subtraction", () => {
    expect(topLevelPrecedence("-2")).toBe(7);
    expect(topLevelPrecedence("4-2")).toBe(5);
    expect(topLevelPrecedence("-2*3")).toBe(6);
  });

  it("reports a term for a product written with no sign", () => {
    expect(topLevelPrecedence("5(6+6)")).toBe(6);
    expect(topLevelPrecedence("(1+2)(3+4)")).toBe(6);
    expect(topLevelPrecedence("(1+2)3")).toBe(6);
    expect(topLevelPrecedence("2π")).toBe(6);
    expect(topLevelPrecedence("3sqrt(9)")).toBe(6);
    // A function's own bracket is its argument list, not a second factor —
    // `sqrt(9)` is one atom where `π(9)` is a product.
    expect(topLevelPrecedence("sqrt(9)")).toBe(10);
    expect(topLevelPrecedence("π(9)")).toBe(6);
    // Inside a bracket it decides nothing — the group is already an atom.
    expect(topLevelPrecedence("(5(6+6))")).toBe(10);
  });

  it("forces brackets on text it cannot read", () => {
    expect(topLevelPrecedence("1 ? 2")).toBe(0);
  });
});
