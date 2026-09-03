// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// An expression set the way it reads: values plain, operators lifted into
// bordered accent chips with air either side, a function with a symbol drawn
// as that symbol, and everything inside a bracket — the brackets, the digits,
// the chips and symbols between them — coloured by how deep it sits (see
// `segments.ts` for the split, and `.oss-expr-op` / `.oss-expr-fn` /
// `.oss-expr-depth-*` in the framework stylesheet for the paint).
//
// This is the still version — a logged calculation, a row in a history, a
// label. Its animated twin (`RevealText`) reveals the same chips, symbols and
// colours character by character, so an expression looks the same on the way
// in as it does once it is written down.

import {
  depthClass,
  expressionSegments,
  type SegmentOptions,
} from "./segments.ts";

export type ExpressionTextProps = {
  /** The expression source, exactly as it is stored. */
  text: string;
  className?: string;
} & SegmentOptions;

export function ExpressionText({
  text,
  className,
  symbols,
}: ExpressionTextProps) {
  return (
    <span className={className}>
      {expressionSegments(text, { symbols }).map((segment) =>
        segment.op ? (
          <span
            key={segment.start}
            className={`oss-expr-op ${depthClass(segment.depth)}`}
          >
            {segment.text}
          </span>
        ) : segment.display ? (
          // `sqrt(9)` reads as `√(9)`: the stored word stays in the document,
          // the glyph is only how it is set.
          <span
            key={segment.start}
            className={`oss-expr-fn ${depthClass(segment.depth)}`}
          >
            {segment.display}
          </span>
        ) : (
          // `whitespace-pre` so the spaces around a word operator survive
          // sitting next to an inline-block chip.
          <span
            key={segment.start}
            className={`whitespace-pre ${depthClass(segment.depth)}`}
          >
            {segment.text}
          </span>
        ),
      )}
    </span>
  );
}
