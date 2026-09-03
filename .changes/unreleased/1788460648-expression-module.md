---
type: Added
title: `expression` — infix arithmetic as text
---

New `expression` subpath: a zero-dependency evaluator (`evaluate`,
`isEvaluable`, `closeParens`, `formatResult`, `formatHex`), the reading behind
operator chips and bracket colouring (`expressionSegments`, `depthClass`,
`toggleSign`), chain folding for "= then keep going" runs (`chainExpression`),
clipboard candidates (`pasteCandidate`), and the two renderers `ExpressionText`
and `RevealText`.
