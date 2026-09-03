// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// How an expression is *read* — the split behind the operator chips a display
// draws. `1+2` is stored, and re-parsed, as three characters; it is read as a
// value, an operator and a value, so that is how it can be set: the operator
// lifts out of the digits into a bordered glyph with air around it, the way it
// sits on a keypad.
//
// Pure and DOM-free — the renderers (`ExpressionText`, `RevealText`) only
// decide what a segment looks like, never where one ends.
//
// Three rules keep the reading honest rather than merely decorative:
//   - only operators with an operand on their left become chips. A leading
//     `−` (or the `~` in `~5`) is a sign on the number that follows, so it
//     stays welded to it — a chipped `[−] 5` would read as a subtraction
//     with its left half missing.
//   - brackets are structure, not arithmetic, so `(` and `)` stay plain: they
//     already group the eye, and boxing them would double the framing. They
//     colour what they hold instead — see `depth` below.
//   - a function that has a symbol is set with it: `sqrt(9)` is stored as the
//     word the evaluator parses but reads as `√(9)`, drawn in the accent so
//     the name stands out of the digits the way an operator does. The bracket
//     stays plain and stays where it is — the symbol replaces the name only,
//     so the reading still shows the call it will evaluate. Which names get a
//     symbol is the caller's to extend ({@link SegmentOptions.symbols}).
//
// Segments carry their `start` index because an animated display keys and
// delays glyphs by character position (`RevealText`), so the split has to say
// where in the source each piece came from.

export type ExpressionSegment = {
  /** Index into the source expression where this segment begins. */
  start: number;
  /** The source text this segment covers, verbatim. */
  text: string;
  /** True when the segment is an operator — the chipped kind. */
  op: boolean;
  /**
   * How many brackets this segment sits inside: 0 out in the open, 1 in the
   * first group, and so on. A bracket itself carries the depth of the group
   * it opens or closes, so `(` and `)` colour with what they hold. Runs are
   * cut at every bracket so no segment straddles two depths.
   */
  depth: number;
  /**
   * What to draw in place of `text`, when the two differ — the `√` a stored
   * `sqrt` reads as. Absent on every segment that is set as it is stored, so
   * a renderer can fall back to `text` and a caller reading the source can
   * ignore this field entirely.
   */
  display?: string;
};

// Operators spelled with two characters. Tried before the single-character
// set so `<<` never reads as two stray `<`.
const TWO_CHAR_OPS = ["<<", ">>"];

// The infix operators of one character, in both the keypad's spelling and the
// one a hardware keyboard types (the evaluator accepts either).
const INFIX_OPS = new Set([
  "+",
  "-",
  "−",
  "*",
  "×",
  "/",
  "÷",
  "%",
  "^",
  "&",
  "|",
]);

// Written after their operand rather than between two: factorial binds to the
// number on its left. Chipped like the rest, and like the rest it leaves an
// operand behind it rather than expecting one.
const POSTFIX_OPS = new Set(["!"]);

// The characters that read as a sign rather than an operation when no operand
// precedes them. `~` is always one of these — bitwise NOT is only ever a
// prefix — so it is never chipped.
const SIGN_CHARS = new Set(["-", "−", "~"]);

// The word operator. Matched only on both-side word boundaries, so the `xor`
// inside a hex literal or a function name is left alone.
const WORD_OPS = ["xor"];

/**
 * Functions written as a symbol rather than a name. Keyed by the spelling the
 * evaluator parses, valued by the glyph to draw for it, so a stored `sqrt(9)`
 * reads back as the `√(9)` that was pressed. Only names immediately followed
 * by their `(` are matched — a bare `sqrt` is not a call, and `sqrtx` is a
 * different name.
 *
 * The default covers the one name with a settled glyph; pass your own through
 * {@link SegmentOptions.symbols} to add (or replace) others.
 */
export const DEFAULT_EXPRESSION_SYMBOLS: Readonly<Record<string, string>> = {
  sqrt: "√",
};

/** Knobs for {@link expressionSegments}. */
export type SegmentOptions = {
  /**
   * Function names to set as a symbol, replacing
   * {@link DEFAULT_EXPRESSION_SYMBOLS} entirely (pass a spread of it to
   * extend rather than replace).
   */
  symbols?: Readonly<Record<string, string>>;
};

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[0-9A-Za-z_.π]/.test(ch);
}

/**
 * Split `text` into the runs the display draws: plain stretches and the
 * operators between them. Concatenating every segment's `text` in order
 * reproduces the input exactly.
 */
export function expressionSegments(
  text: string,
  options: SegmentOptions = {},
): ExpressionSegment[] {
  const symbols = options.symbols ?? DEFAULT_EXPRESSION_SYMBOLS;
  const segments: ExpressionSegment[] = [];
  // The open plain run, flushed whenever an operator or a bracket interrupts
  // it. `runDepth` is the nesting the run opened at — the same for all of it,
  // because a bracket always ends the run it lands in.
  let runStart = 0;
  let run = "";
  let runDepth = 0;
  // How many brackets are open at this point in the text.
  let depth = 0;
  // True while the next thing the expression needs is a value — at the start,
  // after an infix operator, and inside a freshly opened bracket. An infix
  // character landing here has nothing to work on, so it is a sign instead.
  let expectOperand = true;

  const flush = () => {
    if (run === "") return;
    segments.push({ start: runStart, text: run, op: false, depth: runDepth });
    run = "";
  };

  // Start the next plain run here, at whatever depth we are now standing at.
  const openRun = (start: number) => {
    runStart = start;
    runDepth = depth;
  };

  const takeOp = (start: number, op: string, postfix: boolean) => {
    flush();
    segments.push({ start, text: op, op: true, depth });
    openRun(start + op.length);
    expectOperand = !postfix;
  };

  for (let i = 0; i < text.length;) {
    const ch = text[i]!;
    const two = text.slice(i, i + 2);

    if (TWO_CHAR_OPS.includes(two)) {
      takeOp(i, two, false);
      i += 2;
      continue;
    }

    const word = WORD_OPS.find(
      (w) =>
        text.startsWith(w, i) &&
        !isWordChar(text[i - 1]) &&
        !isWordChar(text[i + w.length]),
    );
    if (word) {
      takeOp(i, word, false);
      i += word.length;
      continue;
    }

    const fn = Object.keys(symbols).find(
      (name) =>
        text.startsWith(name, i) &&
        !isWordChar(text[i - 1]) &&
        text[i + name.length] === "(",
    );
    if (fn) {
      flush();
      // The name stands outside the call's brackets, so it keeps the depth it
      // is written at — the argument, not the name, is what the `(` holds.
      segments.push({
        start: i,
        text: fn,
        op: false,
        depth,
        display: symbols[fn]!,
      });
      openRun(i + fn.length);
      // The call still wants its argument, and the `(` about to be read says
      // so too — a `-` right after it is a sign, not a subtraction.
      expectOperand = true;
      i += fn.length;
      continue;
    }

    if (POSTFIX_OPS.has(ch)) {
      takeOp(i, ch, true);
      i += 1;
      continue;
    }

    if (INFIX_OPS.has(ch) && !(expectOperand && SIGN_CHARS.has(ch))) {
      takeOp(i, ch, false);
      i += 1;
      continue;
    }

    // Brackets step the depth and stand alone at it, so the group they hold
    // can be coloured as one piece. An unbalanced `)` has no group to close;
    // it stays at the floor rather than driving the depth negative.
    if (ch === "(" || ch === ")") {
      flush();
      if (ch === "(") depth += 1;
      segments.push({ start: i, text: ch, op: false, depth });
      if (ch === ")") depth = Math.max(0, depth - 1);
      openRun(i + 1);
      expectOperand = ch === "(";
      i += 1;
      continue;
    }

    if (run === "") openRun(i);
    run += ch;
    // Whitespace decides nothing — `1 - 2` still subtracts. A sign kept as one
    // still leaves a value outstanding.
    if (ch.trim() !== "") {
      expectOperand = SIGN_CHARS.has(ch);
    }
    i += 1;
  }

  flush();
  return segments;
}

// How many bracket colours the framework stylesheet carries
// (`--oss-expr-depth-1…3`). Three is enough to read by: what matters is that a
// group never wears its parent's colour, and nothing sane nests deeper than
// this anyway — past it the colours start over rather than running out.
export const EXPRESSION_DEPTH_COLORS = 3;

/**
 * The class that paints a segment at nesting `depth` — "" out in the open,
 * where the expression keeps the surrounding ink. Defined in the framework
 * stylesheet, which maps each one to a theme colour.
 */
export function depthClass(depth: number): string {
  if (depth <= 0) return "";
  return `oss-expr-depth-${((depth - 1) % EXPRESSION_DEPTH_COLORS) + 1}`;
}

// The characters an operand can follow, so a `−` written after one of them is
// a sign rather than a subtraction. An empty left-hand side counts too.
const OPERAND_START = new Set([
  "+",
  "-",
  "−",
  "*",
  "×",
  "/",
  "÷",
  "%",
  "^",
  "&",
  "|",
  "<",
  ">",
  "(",
]);

// The characters a number, constant or literal is spelled with — `0x1F`, `π`
// and `12.5` are each one operand, not several.
const VALUE_CHARS = /[0-9.A-Za-zπ]/;

// The minus at `i` reads as a sign rather than a subtraction: nothing, an
// operator or an open bracket sits to its left, so it has no operand to take
// anything away from.
function signAt(text: string, i: number): boolean {
  const before = text.slice(0, i).trimEnd();
  return before === "" || OPERAND_START.has(before[before.length - 1]!);
}

/**
 * Where the value `text` ends on begins — the start of `34` in `12+34`, of
 * `sqrt(9)` in `1+sqrt(9)`, of `0x1F` in `0x1F`. −1 when the expression does
 * not end on a value at all (it is empty, or its last character is an
 * operator or an open bracket).
 *
 * Brackets are matched back to their opener so a whole call counts as the one
 * operand it evaluates to, and a name in front of that bracket goes with it.
 */
function operandStart(text: string): number {
  // Factorials bind to the value on their left, so they are part of it.
  let i = text.length;
  while (i > 0 && text[i - 1] === "!") i -= 1;
  if (i === 0) return -1;

  if (text[i - 1] === ")") {
    let depth = 0;
    while (i > 0) {
      const ch = text[i - 1]!;
      if (ch === ")") depth += 1;
      else if (ch === "(") depth -= 1;
      i -= 1;
      if (depth === 0) break;
    }
    // An unbalanced `)` is not a value; leave it to the evaluator to complain.
    if (depth !== 0) return -1;
    while (i > 0 && VALUE_CHARS.test(text[i - 1]!)) i -= 1;
    return i;
  }

  if (!VALUE_CHARS.test(text[i - 1]!)) return -1;
  while (i > 0 && VALUE_CHARS.test(text[i - 1]!)) i -= 1;
  return i;
}

/**
 * The expression with the sign of the value the display ends on flipped — the
 * `±` key.
 *
 * It edits that value rather than appending to the expression: the value takes
 * a `−` in front of it, and one that already carries a sign gives it back, so
 * the key is its own undo. With no value to work on (an empty display, or one
 * that ends on an operator) the sign goes down on its own, ready for the
 * digits about to be typed.
 *
 * The result stays inside the one grammar: a leading `−` is
 * the evaluator's unary minus, and the display already reads a sign as welded
 * to the value that follows it (see expressionSegments above), so `12+−5`
 * sets as `12 [+] −5`.
 */
export function toggleSign(text: string): string {
  const at = operandStart(text);
  if (at >= 0) {
    const before = text[at - 1];
    if ((before === "-" || before === "−") && signAt(text, at - 1)) {
      return text.slice(0, at - 1) + text.slice(at);
    }
    return text.slice(0, at) + "−" + text.slice(at);
  }
  const last = text[text.length - 1];
  if ((last === "-" || last === "−") && signAt(text, text.length - 1)) {
    return text.slice(0, -1);
  }
  return text + "−";
}
