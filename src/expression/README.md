<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `expression` — infix arithmetic as text

Arithmetic _the user typed_ is the mechanism; "calculator", "tape", "cell"
are app words and stay out. The module treats an expression's **source text**
as the thing worth keeping — evaluate it, read it, fold a run of them
together, render it — so an app can store the expression rather than a
computed number and still show the same answer on the next open.

Four pure, DOM-free cores plus two renderers:

- **`evaluate.ts`** — a tokenizer and a recursive-descent parser over one
  grammar: `+ - * / %`, `^` (right-associative), `!`, the bitwise set
  (`& | xor << >> ~`, exact over `BigInt`), brackets, constants (`π`, `e`,
  `tau`) and the usual function names (`sqrt`, `sin`, `ln`, `round`, …).
  Juxtaposition multiplies, so `5(6+6)`, `2π` and `3sqrt(9)` read as they are
  written on paper, and trailing brackets are closed for the caller
  (`closeParens`) because a cursorless input can never have meant anything
  else by `sin(2`. Display spellings (`×`, `÷`, `−`) parse alongside their
  ASCII twins. Errors raise `EvalError` with a message a display can show
  verbatim; `isEvaluable` is the cheap gate behind a live preview.
  `formatResult` rounds float noise away (0.1 + 0.2 → `"0.3"`) and
  `formatHex` gives an integer its second spelling.
- **`segments.ts`** — how an expression _reads_. `expressionSegments(text)`
  splits the source into the runs a renderer draws: plain stretches, the
  operators between them (only where an operand actually sits to the left, so
  a leading `−` stays welded to its number), and the function names that are
  set as a symbol (`sqrt(9)` → `√(9)`; extend the map with `symbols`). Every
  segment carries its `start` index and its bracket `depth`, and
  `depthClass(depth)` names the colour class for that depth. `toggleSign`
  is the `±` edit — it flips the sign of the value the text ends on, and is
  its own undo.
- **`chain.ts`** — where an app seeds the next expression with the previous
  result, a run of steps is one nested expression built a piece at a time.
  `chainExpression(steps, index)` folds it back into `(1+2)*2`, bracketing
  only where the grammar would otherwise re-associate it;
  `topLevelPrecedence` is the scan behind that decision, and mirrors the
  grammar in `evaluate.ts` — the two move together.
- **`paste.ts`** — `pasteCandidate(clipboard)` says what a paste would put on
  the input: text the grammar understands pastes verbatim, text it doesn't
  gives up its first number instead (`"Total: $1,234.56"` → `"1234.56"`,
  reading `1.234.567` and `1,234.56` alike), and text with no number in it at
  all offers nothing, so the affordance stays hidden. `pasteLabel` elides it
  for a button.

The two renderers draw the same reading, one still and one animated:

- **`ExpressionText`** — the still version: operator chips, symbol functions,
  bracket colouring. What a logged row or a label shows.
- **`RevealText`** — the typed version. Characters are keyed by _where they
  landed_, so appending mounts one new span and leaves an in-flight animation
  alone, erasing unmounts, and a wholesale replacement (a result taking the
  line over) bumps a generation so the new value reveals as a run.

## Styling

Both renderers paint through the framework stylesheet's `.oss-expr-*` rules
(`framework.css`) — the operator chip, the symbol function, the per-character
reveal, and `--oss-expr-depth-1…3`, which are theme tokens (`link`, `pipe`,
`path`), so every preset dresses an expression in its own syntax colours. Add
`oss-expr-soft` to a container whose expression is small print and the bracket
colours pull back toward the surrounding ink.

## Usage

```tsx
import {
  ExpressionText,
  RevealText,
  chainExpression,
  evaluate,
  isEvaluable,
  pasteCandidate,
  toggleSign,
} from "@niclaslindstedt/oss-framework/expression";

const [text, setText] = useState("");
const preview = isEvaluable(text) ? formatResult(evaluate(text)) : null;

<RevealText text={text} className="text-4xl" />;
<ExpressionText text={"1+sqrt(9)×(2−3)"} className="oss-expr-soft text-sm" />;
```

## What stays in the app

The keypad and its layouts, the modes, what a result is _for_, how a run of
calculations is stored, the clipboard read itself (the framework's
`useClipboard` covers the write half), and any unit / currency vocabulary.
The module renders and evaluates the text it is handed.
