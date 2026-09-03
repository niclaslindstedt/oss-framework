// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  closeParens,
  evaluate,
  EvalError,
  formatHex,
  formatResult,
  isEvaluable,
} from "../src/expression/index.ts";

describe("evaluate", () => {
  it("handles the four basic operations with precedence", () => {
    expect(evaluate("1 + 2 * 3")).toBe(7);
    expect(evaluate("10 - 4 / 2")).toBe(8);
    expect(evaluate("(1 + 2) * 3")).toBe(9);
  });

  it("accepts the display spellings a keypad emits", () => {
    expect(evaluate("12 × 4")).toBe(48);
    expect(evaluate("9 ÷ 3")).toBe(3);
    expect(evaluate("5 − 8")).toBe(-3);
  });

  it("handles unary minus and nested parens", () => {
    expect(evaluate("-5 + 3")).toBe(-2);
    expect(evaluate("-(2 * (3 + 1))")).toBe(-8);
    expect(evaluate("--4")).toBe(4);
  });

  it("closes brackets left open on the end", () => {
    expect(evaluate("sqrt(9")).toBe(3);
    expect(evaluate("sin(0")).toBe(0);
    expect(evaluate("(25 + 3) * (5 + 1")).toBe(168);
    expect(evaluate("2 * (3 + (4 - 1")).toBe(12);
  });

  it("still refuses a closer that never opened", () => {
    expect(() => evaluate("(1 + 2))")).toThrow(EvalError);
    expect(() => evaluate(")")).toThrow(EvalError);
  });

  it("treats % as modulo", () => {
    expect(evaluate("10 % 3")).toBe(1);
    expect(evaluate("7.5 % 2")).toBe(1.5);
  });

  it("makes ^ right-associative and bind tighter than unary minus", () => {
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluate("-2 ^ 2")).toBe(-4);
  });

  it("multiplies a value written straight onto a bracket", () => {
    expect(evaluate("5(6+6)")).toBe(60);
    expect(evaluate("(1+2)(3+4)")).toBe(21);
    expect(evaluate("(1+2)3")).toBe(9);
    expect(evaluate("2(3)(4)")).toBe(24);
    expect(evaluate("3(4")).toBe(12);
  });

  it("multiplies a value written straight onto a name", () => {
    expect(evaluate("2π")).toBeCloseTo(Math.PI * 2);
    expect(evaluate("2pi")).toBeCloseTo(Math.PI * 2);
    expect(evaluate("3sqrt(9)")).toBe(9);
    expect(evaluate("sqrt(9)3")).toBe(9);
    expect(evaluate("(1+1)e")).toBeCloseTo(Math.E * 2);
  });

  it("binds an implicit × exactly where an explicit one binds", () => {
    expect(evaluate("2+3(4)")).toBe(evaluate("2+3*4"));
    expect(evaluate("2^3(4)")).toBe(evaluate("2^3*4"));
    expect(evaluate("2(3)^2")).toBe(evaluate("2*(3)^2"));
    expect(evaluate("1/2(3)")).toBe(evaluate("1/2*3"));
    expect(evaluate("-2(3)")).toBe(-6);
    expect(evaluate("3!(2)")).toBe(12);
  });

  it("reads a sign after a value as an operator, never as a product", () => {
    expect(evaluate("2-3")).toBe(-1);
    expect(() => evaluate("2~3")).toThrow(EvalError);
  });

  it("refuses two literals side by side", () => {
    // Only whitespace can separate them, and no key types it — `1 000` is a
    // mis-spaced number in a hand-edited file, not `1 × 000`.
    expect(() => evaluate("1 000")).toThrow(EvalError);
    expect(() => evaluate("2 3")).toThrow(EvalError);
  });

  it("evaluates scientific functions and constants", () => {
    expect(evaluate("sqrt(9)")).toBe(3);
    expect(evaluate("abs(-4.2)")).toBe(4.2);
    expect(evaluate("sin(0)")).toBe(0);
    expect(evaluate("ln(e)")).toBeCloseTo(1);
    expect(evaluate("log(1000)")).toBeCloseTo(3);
    expect(evaluate("π")).toBeCloseTo(Math.PI);
    expect(evaluate("2 * pi")).toBeCloseTo(Math.PI * 2);
  });

  it("evaluates factorial as a postfix operator", () => {
    expect(evaluate("5!")).toBe(120);
    expect(evaluate("0!")).toBe(1);
    expect(evaluate("3! + 1")).toBe(7);
    expect(() => evaluate("(-1)!")).toThrow(EvalError);
    expect(() => evaluate("2.5!")).toThrow(EvalError);
  });

  it("evaluates programmer-mode literals and bitwise operators", () => {
    expect(evaluate("0xFF")).toBe(255);
    expect(evaluate("0b101")).toBe(5);
    expect(evaluate("12 & 10")).toBe(8);
    expect(evaluate("12 | 10")).toBe(14);
    expect(evaluate("12 xor 10")).toBe(6);
    expect(evaluate("1 << 8")).toBe(256);
    expect(evaluate("256 >> 4")).toBe(16);
    expect(evaluate("~0")).toBe(-1);
  });

  it("gives bitwise operators C-like precedence below arithmetic", () => {
    expect(evaluate("1 << 2 + 1")).toBe(8);
    expect(evaluate("0xF0 | 0x0F & 0xFF")).toBe(255);
  });

  it("rejects bitwise operations on fractions", () => {
    expect(() => evaluate("1.5 & 2")).toThrow(EvalError);
    expect(() => evaluate("~0.5")).toThrow(EvalError);
  });

  it("raises readable errors on malformed input", () => {
    expect(() => evaluate("")).toThrow(EvalError);
    expect(() => evaluate("1 +")).toThrow(EvalError);
    expect(() => evaluate("sqrt()")).toThrow(EvalError);
    expect(() => evaluate("1..2")).toThrow(EvalError);
    expect(() => evaluate("1 $ 2")).toThrow(EvalError);
    expect(() => evaluate("bogus(1)")).toThrow(EvalError);
  });

  it("raises on division by zero and non-finite results", () => {
    expect(() => evaluate("1 / 0")).toThrow(EvalError);
    expect(() => evaluate("5 % 0")).toThrow(EvalError);
    expect(() => evaluate("10 ^ 1000")).toThrow(EvalError);
  });
});

describe("formatResult", () => {
  it("prints integers plainly", () => {
    expect(formatResult(42)).toBe("42");
    expect(formatResult(-7)).toBe("-7");
  });

  it("rounds away binary-float noise", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
    expect(formatResult(evaluate("1.1 * 3"))).toBe("3.3");
  });
});

describe("formatHex", () => {
  it("spells integers in hex and skips fractions", () => {
    expect(formatHex(255)).toBe("0xFF");
    expect(formatHex(-16)).toBe("-0x10");
    expect(formatHex(1.5)).toBeNull();
  });
});

describe("closeParens", () => {
  it("adds the closers an expression is short of", () => {
    expect(closeParens("sin(2")).toBe("sin(2)");
    expect(closeParens("sqrt(3")).toBe("sqrt(3)");
    expect(closeParens("(25+3)*(5+1")).toBe("(25+3)*(5+1)");
    expect(closeParens("2*(3+(4-1")).toBe("2*(3+(4-1))");
  });

  it("leaves a balanced expression exactly as it is", () => {
    expect(closeParens("(1+2)*3")).toBe("(1+2)*3");
    expect(closeParens("12+34")).toBe("12+34");
    expect(closeParens("")).toBe("");
  });

  it("hands a stray closer to the parser untouched", () => {
    expect(closeParens("(1+2))")).toBe("(1+2))");
    expect(closeParens(")(")).toBe(")(");
  });
});

describe("isEvaluable", () => {
  it("mirrors evaluate without throwing", () => {
    expect(isEvaluable("1 + 1")).toBe(true);
    expect(isEvaluable("1 +")).toBe(false);
  });

  it("counts an expression with its brackets left open", () => {
    expect(isEvaluable("sqrt(3")).toBe(true);
  });
});
