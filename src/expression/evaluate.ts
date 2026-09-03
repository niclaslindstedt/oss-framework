// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// The evaluator: a tokenizer + recursive-descent parser over ordinary infix
// arithmetic. Pure and DOM-free, so an app can evaluate, re-evaluate and
// round-trip an expression anywhere — in a worker, in a test, in a document
// codec — without a browser.
//
// One grammar serves every caller. An expression written against one input
// surface re-evaluates identically anywhere else, which is what makes the
// text a safe thing to *store*: the source, not a computed value, is the
// document.
//
// Grammar (loosest binding first):
//   expression := xorExpr ("|" xorExpr)*
//   xorExpr    := andExpr ("xor" andExpr)*
//   andExpr    := shiftExpr ("&" shiftExpr)*
//   shiftExpr  := additive (("<<" | ">>") additive)*
//   additive   := term (("+" | "-") term)*
//   term       := unary (("*" | "/" | "%")? unary)*   omitted sign = ×
//   unary      := ("-" | "~") unary | power
//   power      := postfix ("^" unary)?           right-associative
//   postfix    := primary "!"*
//   primary    := number | constant | function "(" expression ")"
//              | "(" expression ")"
//
// Brackets left open on the end are closed for the caller — `sin(2` reads as
// `sin(2)` (see {@link closeParens}) — so an input surface with no cursor
// never has to go back for the keystroke that was never in doubt. The `×`
// between a value and a bracket is treated the same way: `5(6+6)` is the
// product it is written as on paper, and so are `2π`, `(1+2)(3+4)` and
// `3sqrt(9)`.
//
// `%` is the modulo operator, not percent — matching how an expression reads
// back as plain text. Trig works in radians. Bitwise operators require integer
// operands and evaluate over BigInt (64-bit range), so results stay exact.
// Errors raise {@link EvalError} with a human-readable message a display can
// show verbatim.
//
// The display spellings the keypad-style inputs emit (`×`, `÷`, `−`, `π`) are
// accepted alongside their ASCII equivalents, so stored text may use either.

export class EvalError extends Error {}

// Display aliases: an on-screen keypad draws × ÷ − and π, and the stored
// expression keeps those characters, so the tokenizer accepts both spellings.
const MUL = new Set(["*", "×"]);
const DIV = new Set(["/", "÷"]);
const MINUS = new Set(["-", "−"]);

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

/**
 * Whether `word` is one of the constants the tokenizer reads as a value in its
 * own right (`π`, `e`, `tau`) rather than as the name of a call. The split
 * matters wherever a name meets a bracket: `sqrt(3)` is one call, `π(3)` is a
 * constant times a group — {@link topLevelPrecedence} reads expressions by
 * the same rule.
 */
export function isConstantName(word: string): boolean {
  return word.toLowerCase() in CONSTANTS;
}

type Op =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "^"
  | "&"
  | "|"
  | "xor"
  | "<<"
  | ">>"
  | "~"
  | "!";

// The operators of the term level, where implicit multiplication also lives.
const TERM_OPS: readonly Op[] = ["*", "/", "%"];

type Token =
  // `constant` marks a value written as a name (`π`, `e`, `tau`) rather than
  // as a literal. It parses exactly like a literal; the flag matters only to
  // implicit multiplication, which reads `2π` as a product but two literals
  // in a row as a mis-spaced number (see impliesMultiplication).
  | { kind: "number"; value: number; constant?: true }
  | { kind: "op"; op: Op }
  | { kind: "func"; name: string }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t") {
      i += 1;
    } else if (/^0[xb]/i.test(input.slice(i, i + 2))) {
      const isHex = input[i + 1]!.toLowerCase() === "x";
      const digits = isHex ? /[0-9a-fA-F]/ : /[01]/;
      let j = i + 2;
      while (j < input.length && digits.test(input[j]!)) j += 1;
      if (j === i + 2)
        throw new EvalError(`malformed number "${input.slice(i, j)}"`);
      tokens.push({
        kind: "number",
        value: Number.parseInt(input.slice(i + 2, j), isHex ? 16 : 2),
      });
      i = j;
    } else if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j += 1;
      const text = input.slice(i, j);
      if ((text.match(/\./g) ?? []).length > 1 || text === ".") {
        throw new EvalError(`malformed number "${text}"`);
      }
      tokens.push({ kind: "number", value: Number.parseFloat(text) });
      i = j;
    } else if (/[a-zA-Zπ]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9π]/.test(input[j]!)) j += 1;
      const word = input.slice(i, j).toLowerCase();
      if (word === "xor") {
        tokens.push({ kind: "op", op: "xor" });
      } else if (word in CONSTANTS) {
        tokens.push({
          kind: "number",
          value: CONSTANTS[word]!,
          constant: true,
        });
      } else if (word in FUNCTIONS) {
        tokens.push({ kind: "func", name: word });
      } else {
        throw new EvalError(`unknown name "${word}"`);
      }
      i = j;
    } else if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
    } else if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
    } else if (ch === "<" || ch === ">") {
      if (input[i + 1] !== ch)
        throw new EvalError(`unexpected character "${ch}"`);
      tokens.push({ kind: "op", op: ch === "<" ? "<<" : ">>" });
      i += 2;
    } else if (ch === "+") {
      tokens.push({ kind: "op", op: "+" });
      i += 1;
    } else if (MINUS.has(ch)) {
      tokens.push({ kind: "op", op: "-" });
      i += 1;
    } else if (MUL.has(ch)) {
      tokens.push({ kind: "op", op: "*" });
      i += 1;
    } else if (DIV.has(ch)) {
      tokens.push({ kind: "op", op: "/" });
      i += 1;
    } else if (
      ch === "%" ||
      ch === "^" ||
      ch === "&" ||
      ch === "|" ||
      ch === "~" ||
      ch === "!"
    ) {
      tokens.push({ kind: "op", op: ch });
      i += 1;
    } else {
      throw new EvalError(`unexpected character "${ch}"`);
    }
  }
  return tokens;
}

// Bitwise helpers: exact over BigInt, defined only for integer operands.
function asBigInt(value: number, opName: string): bigint {
  if (!Number.isInteger(value)) {
    throw new EvalError(`${opName} needs whole numbers`);
  }
  return BigInt(value);
}

function fromBigInt(value: bigint): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) throw new EvalError("result is too large");
  return num;
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new EvalError("! needs a whole number ≥ 0");
  }
  if (value > 170) throw new EvalError("result is too large");
  let acc = 1;
  for (let n = 2; n <= value; n += 1) acc *= n;
  return acc;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    if (this.tokens.length === 0) throw new EvalError("empty expression");
    const value = this.expression();
    if (this.pos < this.tokens.length) {
      throw new EvalError("unexpected trailing input");
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private binaryLevel(ops: readonly Op[], next: () => number): number {
    let left = next();
    for (;;) {
      const tok = this.peek();
      if (tok?.kind !== "op" || !ops.includes(tok.op)) return left;
      this.pos += 1;
      const right = next();
      left = this.apply(tok.op, left, right);
    }
  }

  private apply(op: Op, left: number, right: number): number {
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        if (right === 0) throw new EvalError("division by zero");
        return left / right;
      case "%":
        if (right === 0) throw new EvalError("division by zero");
        return left % right;
      case "&":
        return fromBigInt(asBigInt(left, "&") & asBigInt(right, "&"));
      case "|":
        return fromBigInt(asBigInt(left, "|") | asBigInt(right, "|"));
      case "xor":
        return fromBigInt(asBigInt(left, "xor") ^ asBigInt(right, "xor"));
      case "<<":
        return fromBigInt(asBigInt(left, "<<") << asBigInt(right, "<<"));
      case ">>":
        return fromBigInt(asBigInt(left, ">>") >> asBigInt(right, ">>"));
      default:
        throw new EvalError(`unexpected operator "${op}"`);
    }
  }

  private expression(): number {
    return this.binaryLevel(["|"], () =>
      this.binaryLevel(["xor"], () =>
        this.binaryLevel(["&"], () =>
          this.binaryLevel(["<<", ">>"], () =>
            this.binaryLevel(["+", "-"], () => this.term()),
          ),
        ),
      ),
    );
  }

  // Multiplication and division, including the multiplication written with no
  // sign at all: `5(6+6)`, `2π`, `(1+2)(3+4)`, `3sqrt(9)`. Juxtaposition is
  // handled here, at the level an explicit `×` sits on, so the two spellings
  // can never disagree — `2^3(4)` is `(2^3)×4` exactly as `2^3*4` is, and
  // `1/2(3)` is `1/2×3`. There is one grammar, so an expression written on
  // one input surface re-evaluates the same on any other.
  private term(): number {
    let left = this.unary();
    for (;;) {
      const tok = this.peek();
      if (tok?.kind === "op" && TERM_OPS.includes(tok.op)) {
        this.pos += 1;
        left = this.apply(tok.op, left, this.unary());
      } else if (this.impliesMultiplication(tok)) {
        left = this.apply("*", left, this.unary());
      } else {
        return left;
      }
    }
  }

  // Whether `tok` opens a value that the one just parsed multiplies. A
  // bracketed group, a function call and a constant all do; a sign does not —
  // `2-3` is a subtraction and `2~3` is nothing at all, so neither `-` nor `~`
  // may start an implicit right-hand side.
  //
  // The one juxtaposition that is not a product is two literals in a row.
  // Only whitespace can separate them, and a keypad cannot type it — so a
  // `1 000` reaching here came from hand-edited text, where it is a mis-spaced
  // number rather than `1 × 000`. Saying so beats answering 0.
  private impliesMultiplication(tok: Token | undefined): boolean {
    if (tok === undefined) return false;
    if (tok.kind === "func" || tok.kind === "lparen") return true;
    if (tok.kind !== "number") return false;
    if (tok.constant) return true;
    const previous = this.tokens[this.pos - 1];
    return previous?.kind !== "number" || previous.constant === true;
  }

  private unary(): number {
    const tok = this.peek();
    if (tok?.kind === "op" && tok.op === "-") {
      this.pos += 1;
      return -this.unary();
    }
    if (tok?.kind === "op" && tok.op === "~") {
      this.pos += 1;
      return fromBigInt(~asBigInt(this.unary(), "~"));
    }
    return this.power();
  }

  private power(): number {
    const base = this.postfix();
    const tok = this.peek();
    if (tok?.kind === "op" && tok.op === "^") {
      this.pos += 1;
      // Right-associative: 2^3^2 = 2^(3^2) = 512.
      return base ** this.unary();
    }
    return base;
  }

  private postfix(): number {
    let value = this.primary();
    while (
      this.peek()?.kind === "op" &&
      (this.peek() as { op: Op }).op === "!"
    ) {
      this.pos += 1;
      value = factorial(value);
    }
    return value;
  }

  private primary(): number {
    const tok = this.peek();
    if (tok === undefined) throw new EvalError("unexpected end of expression");
    if (tok.kind === "number") {
      this.pos += 1;
      return tok.value;
    }
    if (tok.kind === "func") {
      this.pos += 1;
      if (this.peek()?.kind !== "lparen") {
        throw new EvalError(`${tok.name} needs parentheses`);
      }
      this.pos += 1;
      const arg = this.expression();
      if (this.peek()?.kind !== "rparen") {
        throw new EvalError("missing closing parenthesis");
      }
      this.pos += 1;
      const value = FUNCTIONS[tok.name]!(arg);
      if (Number.isNaN(value)) {
        throw new EvalError(`${tok.name} is undefined there`);
      }
      return value;
    }
    if (tok.kind === "lparen") {
      this.pos += 1;
      const value = this.expression();
      if (this.peek()?.kind !== "rparen") {
        throw new EvalError("missing closing parenthesis");
      }
      this.pos += 1;
      return value;
    }
    throw new EvalError("expected a number or parenthesis");
  }
}

// The `)`s an expression is short of, added on the end. A cursorless display
// opens brackets left to right and never offers a way back into the middle of
// one, so a trailing `sin(2` can only ever have meant `sin(2)` — the run of
// closers that finishes it is the only reading there is. Closing them for the
// user is what such an input surface owes them; leaving `sin(2` to fail would
// only ask for the one keystroke whose position was never in doubt.
//
// Only the tail is filled in. A `)` that arrives with nothing open (`(1+2))`)
// is a genuine mistake rather than an omission, so the text is handed to the
// parser untouched and it says so.
export function closeParens(expression: string): string {
  let depth = 0;
  for (const ch of expression) {
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) return expression;
    }
  }
  return depth > 0 ? expression + ")".repeat(depth) : expression;
}

// Evaluate an infix expression, closing any brackets left open on the end
// (see closeParens). Throws EvalError on malformed input, division by zero,
// or a non-finite result (overflow).
export function evaluate(expression: string): number {
  const value = new Parser(tokenize(closeParens(expression))).parse();
  if (!Number.isFinite(value)) throw new EvalError("result is not finite");
  return value;
}

// Format a result for display or storage. Rounds away binary-float noise
// (0.1 + 0.2 → "0.3") while keeping up to 12 significant digits.
export function formatResult(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return String(value);
  }
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

// Hex rendering — a secondary spelling for an integer result. Null for
// non-integers (there is no honest hex spelling to show).
export function formatHex(value: number): string | null {
  if (!Number.isInteger(value)) return null;
  const negative = value < 0;
  return `${negative ? "-" : ""}0x${Math.abs(value).toString(16).toUpperCase()}`;
}

// True when the expression evaluates cleanly — the gate behind a live preview
// or an "evaluate" control.
export function isEvaluable(expression: string): boolean {
  try {
    evaluate(expression);
    return true;
  } catch {
    return false;
  }
}
