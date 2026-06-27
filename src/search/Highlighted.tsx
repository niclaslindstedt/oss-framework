// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Fragment } from "react";

import { segmentMatches, type MatchRange } from "./matcher.ts";

// Render a string with its matched character ranges wrapped in <mark>, leaving
// the rest as plain text. Drop it anywhere you show a search hit — a result
// row's title, a clipped body snippet — so the user sees *why* the row matched.
// Ranges come from the matcher (`CompiledQuery.match(...).ranges`), already
// sorted and non-overlapping.

type Props = {
  text: string;
  ranges: MatchRange[];
  // Class applied to each <mark>. Defaults to a subtle accent-tinted highlight
  // that inherits the surrounding font weight; override to restyle.
  markClassName?: string;
};

const DEFAULT_MARK_CLASS =
  "rounded-[2px] bg-accent/30 text-fg-bright [font-weight:inherit]";

export function Highlighted({
  text,
  ranges,
  markClassName = DEFAULT_MARK_CLASS,
}: Props) {
  return (
    <>
      {segmentMatches(text, ranges).map((seg, i) =>
        seg.match ? (
          <mark key={i} className={markClassName}>
            {seg.text}
          </mark>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}
