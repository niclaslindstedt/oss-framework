// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Typed-in text, one character at a time. Every glyph gets its own
// inline-block so a newly arrived one can slide in from the right while the
// text already on the line settles left of it — the readout "types" the way
// the keys are pressed. Operators arrive whole instead, as one chipped glyph,
// and so does a function with a symbol — `sqrt(` lands as an accented `√` and
// its bracket. Anything inside a bracket takes that group's colour
// (`segments.ts` decides which runs those are and how deep they sit;
// `ExpressionText` draws the still version of the same thing).
//
// The whole trick is identity: characters are keyed by where they landed, so
// an append mounts one new span and leaves the rest alone (no restart of an
// animation still in flight), an erase unmounts spans, and a wholesale
// replacement — a computed result taking the line over — bumps a generation
// so every glyph mounts fresh and the new value reveals as a run. Delays are
// assigned once, when a character first appears, and never rewritten
// underneath a running animation.
//
// The animation itself lives in the framework stylesheet (`.oss-expr-char`),
// which also drops it under `prefers-reduced-motion`.

import { useRef } from "react";

import {
  depthClass,
  expressionSegments,
  type SegmentOptions,
} from "./segments.ts";

// The beat between characters of the same arrival. One keypress brings one
// character, so this only shows on a paste or on a revealed result — fast
// enough to read as a single motion rather than a queue.
const STEP_MS = 22;

// …and the longest a character will wait its turn. A pasted or revealed run
// stops staggering after this many glyphs so a long number still lands at
// once instead of crawling in.
const MAX_STEPS = 10;

export type RevealTextProps = {
  /** The expression source, exactly as it is stored. */
  text: string;
  className?: string;
} & SegmentOptions;

export function RevealText({ text, className, symbols }: RevealTextProps) {
  const shown = useRef("");
  // Bumped whenever the text is replaced rather than typed into, to remount
  // every character.
  const generation = useRef(0);
  // Per-character animation delay, by index. Written when a character first
  // appears and left alone afterwards.
  const delays = useRef<number[]>([]);

  if (text !== shown.current) {
    const before = shown.current;
    let from: number;
    if (text.startsWith(before)) {
      // Typed (or pasted) onto the end — only the new tail reveals.
      from = before.length;
    } else if (before.startsWith(text)) {
      // Erased — what is left was already on screen.
      from = text.length;
    } else {
      // Replaced wholesale: a computed result taking the line over.
      generation.current += 1;
      from = 0;
    }
    delays.current.length = text.length;
    for (let i = from; i < text.length; i += 1) {
      delays.current[i] = Math.min(i - from, MAX_STEPS) * STEP_MS;
    }
    shown.current = text;
  }

  const gen = generation.current;
  // `extra` is the treatment the segment asked for — the operator chip, the
  // accent a symbol function is set in, the colour of the bracket group it
  // sits inside — on top of the per-character animation every glyph carries.
  const glyph = (
    key: string,
    index: number,
    content: string,
    extra?: string,
  ) => (
    <span
      key={key}
      className={extra ? `oss-expr-char ${extra}` : "oss-expr-char"}
      style={{ animationDelay: `${delays.current[index] ?? 0}ms` }}
    >
      {content}
    </span>
  );

  return (
    <span className={className}>
      {/* The split-up glyphs are decoration; screen readers get the string. */}
      <span aria-hidden="true">
        {expressionSegments(text, { symbols }).map((segment) => {
          // The colour of the group this segment sits in, which every glyph
          // of it wears — empty out in the open, where the line's own ink
          // stands.
          const nest = depthClass(segment.depth);
          // An operator reveals as one piece: it is a single glyph on a
          // keypad, so it should not type itself in letter by letter. A
          // symbol function is one keypress and one glyph too, however many
          // characters the word behind it is stored as.
          if (segment.op)
            return glyph(
              `${gen}:${segment.start}`,
              segment.start,
              segment.text,
              `oss-expr-op ${nest}`.trim(),
            );
          if (segment.display)
            return glyph(
              `${gen}:${segment.start}`,
              segment.start,
              segment.display,
              `oss-expr-fn ${nest}`.trim(),
            );
          return Array.from(segment.text, (char, offset) =>
            glyph(
              `${gen}:${segment.start + offset}`,
              segment.start + offset,
              char,
              nest,
            ),
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
