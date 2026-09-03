// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Expression chains. Where an app seeds the next expression with the previous
// result, a run of calculations is really one nested expression the user built
// a step at a time:
//
//   1+2 = 3
//   3*2 = 6      ← chained: it starts from the previous result
//
// {@link chainExpression} folds that run back into a single expression —
// `(1+2)*2` — by substituting each step's leading result with the expression
// that produced it. Parentheses go in only where the grammar needs them to
// preserve the value: `(1+2)*2`, but `1+2+4` (same precedence, left
// associative) and `2*3+4` (the inner binds tighter already). A step that
// continues with a bracket rather than an operator is the same substitution —
// `1+2 = 3`, then `3(4)`, folds to `(1+2)(4)`, because juxtaposition is
// multiplication in the grammar (`evaluate.ts`).
//
// Pure and DOM-free. The precedence table below mirrors the grammar in
// `evaluate.ts` — the two must move together.

import { isConstantName } from "./evaluate.ts";

/**
 * One step of a chain, as much of it as the fold needs: the expression the
 * step evaluated and the result it produced, plus whether the step *continued*
 * from the one before it. Whatever else an app's record of a calculation
 * carries — an id, a timestamp, a note — is its own business.
 */
export type ChainStep = {
  /** The expression text this step evaluated. */
  expression: string;
  /** The result it produced, spelled exactly as it was seeded into the next
   *  step's expression (see {@link chainExpression}). */
  result: string;
  /** True when this step's expression started from the previous step's
   *  result rather than from a cleared slate. */
  chained?: boolean;
};

// Binding strength, loosest first. `ATOM` is a value that needs no parens in
// any context (a literal, a parenthesized group, a function call).
const P_OR = 1;
const P_XOR = 2;
const P_AND = 3;
const P_SHIFT = 4;
const P_ADDITIVE = 5;
const P_TERM = 6;
const P_UNARY = 7;
const P_POWER = 8;
const P_POSTFIX = 9;
const ATOM = 10;

// Single-character binary operators, in the display spellings a keypad
// emits as well as the ASCII ones (the evaluator accepts both).
const BINARY_CHARS: Record<string, number> = {
  "|": P_OR,
  "&": P_AND,
  "+": P_ADDITIVE,
  "-": P_ADDITIVE,
  "−": P_ADDITIVE,
  "*": P_TERM,
  "×": P_TERM,
  "/": P_TERM,
  "÷": P_TERM,
  "%": P_TERM,
};

// The weakest binding an expression exposes at the top level — what decides
// whether it survives being dropped into a tighter context unbracketed. Scans
// the text rather than parsing it: everything inside parentheses is skipped,
// because a bracketed group already binds as tightly as an atom. Unknown
// characters return 0, which forces parentheses (safe by construction).
export function topLevelPrecedence(expression: string): number {
  let weakest = ATOM;
  let depth = 0;
  // True where a value is expected — the position a `-` or `~` reads as a
  // sign rather than as subtraction.
  let expectValue = true;
  let i = 0;

  const note = (precedence: number) => {
    if (depth === 0 && precedence < weakest) weakest = precedence;
  };

  while (i < expression.length) {
    const ch = expression[i]!;
    if (ch === " " || ch === "\t") {
      i += 1;
    } else if (ch === "(") {
      // A group opening where a value is already in hand is multiplied by it
      // — `5(6+6)` binds as loosely as `5×(6+6)` does.
      if (!expectValue) note(P_TERM);
      depth += 1;
      expectValue = true;
      i += 1;
    } else if (ch === ")") {
      depth -= 1;
      expectValue = false;
      i += 1;
    } else if (ch === "<" || ch === ">") {
      if (expression[i + 1] !== ch) return 0;
      note(P_SHIFT);
      expectValue = true;
      i += 2;
    } else if (/[0-9.]/.test(ch)) {
      // `(1+2)3` — a literal after a value is the same implicit product.
      if (!expectValue) note(P_TERM);
      while (i < expression.length && /[0-9a-fA-FxX.]/.test(expression[i]!)) {
        i += 1;
      }
      expectValue = false;
    } else if (/[a-zA-Zπ]/.test(ch)) {
      let j = i;
      while (j < expression.length && /[a-zA-Z0-9π]/.test(expression[j]!)) {
        j += 1;
      }
      const word = expression.slice(i, j).toLowerCase();
      if (word === "xor") {
        note(P_XOR);
        expectValue = true;
      } else {
        // A constant or a function name; either way this reads as an atom —
        // one that a value in front of it multiplies (`2π`, `3sqrt(9)`).
        if (!expectValue) note(P_TERM);
        // A function is not a value until its argument list closes, so the
        // `(` about to be read is that list rather than a second factor. A
        // constant is a value already, and a bracket after it opens one.
        expectValue = !isConstantName(word);
      }
      i = j;
    } else if (ch === "!") {
      note(P_POSTFIX);
      expectValue = false;
      i += 1;
    } else if (ch === "^") {
      note(P_POWER);
      expectValue = true;
      i += 1;
    } else if (ch === "~") {
      note(P_UNARY);
      expectValue = true;
      i += 1;
    } else if (ch in BINARY_CHARS) {
      // A sign, not an operator, where a value was expected.
      note(expectValue ? P_UNARY : BINARY_CHARS[ch]!);
      expectValue = true;
      i += 1;
    } else {
      return 0;
    }
  }
  return weakest;
}

// How tightly the substituted value must bind to survive the operator that
// follows it. Null when the remainder does not start with an operator at all
// — the value was edited into a longer number, not used as an operand, so
// there is no honest chain to build.
function contextAfter(
  rest: string,
): { precedence: number; rightAssociative: boolean } | null {
  const s = rest.replace(/^[ \t]+/, "");
  if (s.startsWith("<<") || s.startsWith(">>")) {
    return { precedence: P_SHIFT, rightAssociative: false };
  }
  if (/^xor(?![a-zA-Z0-9π])/i.test(s)) {
    return { precedence: P_XOR, rightAssociative: false };
  }
  const ch = s[0] ?? "";
  if (ch === "!") return { precedence: P_POSTFIX, rightAssociative: false };
  // `^` is right-associative, so even an equally-binding left operand needs
  // brackets: `2^3^2` means `2^(3^2)`.
  if (ch === "^") return { precedence: P_POWER, rightAssociative: true };
  // Implicit multiplication: a bracket, a function call or a constant written
  // straight after the value multiplies it, so the step used the result as an
  // operand after all. A digit does not — that is the result being edited into
  // a longer number, which is no chain at all.
  if (ch === "(" || /[a-zA-Zπ]/.test(ch)) {
    return { precedence: P_TERM, rightAssociative: false };
  }
  if (ch in BINARY_CHARS) {
    return { precedence: BINARY_CHARS[ch]!, rightAssociative: false };
  }
  return null;
}

// Splice `inner` into the head of a step whose remainder is `rest`, wrapping
// it only where the grammar would otherwise re-associate the expression.
function spliceChain(inner: string, rest: string): string | null {
  if (rest.trim() === "") return inner;
  const context = contextAfter(rest);
  if (context === null) return null;
  const bound = topLevelPrecedence(inner);
  const needsParens = context.rightAssociative
    ? bound <= context.precedence
    : bound < context.precedence;
  return `${needsParens ? `(${inner})` : inner}${rest}`;
}

/**
 * True when the step at `index` continued from the one before it — the run it
 * belongs to has more than one step, so there is a chain worth folding.
 */
export function isChained(
  entries: readonly ChainStep[],
  index: number,
): boolean {
  return index > 0 && Boolean(entries[index]?.chained);
}

/**
 * Fold the run of calculations ending at `index` into one expression. Returns
 * null when the step starts its own run, or when the stored text no longer
 * lines up (hand-edited text) and no faithful chain can be built.
 */
export function chainExpression(
  entries: readonly ChainStep[],
  index: number,
): string | null {
  if (!isChained(entries, index)) return null;
  let start = index;
  while (start > 0 && entries[start]!.chained) start -= 1;

  let chained = entries[start]!.expression;
  for (let step = start + 1; step <= index; step += 1) {
    const previous = entries[step - 1]!;
    const expression = entries[step]!.expression;
    if (!expression.startsWith(previous.result)) return null;
    const spliced = spliceChain(
      chained,
      expression.slice(previous.result.length),
    );
    if (spliced === null) return null;
    chained = spliced;
  }
  return chained === entries[index]!.expression ? null : chained;
}
