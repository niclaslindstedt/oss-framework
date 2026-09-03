// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public `expression` surface: infix arithmetic as *text* — evaluated,
// re-read, folded and rendered.
//
// The mechanism is "an expression the user typed is the document"; what an app
// does with it (a calculator tape, a spreadsheet-ish cell, a numeric field
// that accepts `12*3`, a unit converter) is the app's business. Four pure,
// DOM-free cores plus two renderers:
//
//   evaluate.ts — tokenizer + recursive-descent parser, one grammar
//   segments.ts — how an expression *reads*: operator chips, symbol
//                 functions, bracket depth; plus the `±` sign toggle
//   chain.ts    — folds a run of "= then keep going" steps back into one
//                 bracketed expression
//   paste.ts    — what the clipboard has to offer an expression input
//
// The renderers (`ExpressionText`, `RevealText`) paint through the framework
// stylesheet's `.oss-expr-*` rules, so they follow the active theme.
// See ./README.md.

export {
  EvalError,
  closeParens,
  evaluate,
  formatHex,
  formatResult,
  isConstantName,
  isEvaluable,
} from "./evaluate.ts";
export {
  DEFAULT_EXPRESSION_SYMBOLS,
  EXPRESSION_DEPTH_COLORS,
  depthClass,
  expressionSegments,
  toggleSign,
  type ExpressionSegment,
  type SegmentOptions,
} from "./segments.ts";
export {
  chainExpression,
  isChained,
  topLevelPrecedence,
  type ChainStep,
} from "./chain.ts";
export {
  pasteCandidate,
  pasteLabel,
  type PasteCandidate,
  type PasteKind,
} from "./paste.ts";
export { ExpressionText, type ExpressionTextProps } from "./ExpressionText.tsx";
export { RevealText, type RevealTextProps } from "./RevealText.tsx";
