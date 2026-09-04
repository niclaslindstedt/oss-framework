// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Measuring text against the box it actually landed in.
//
// `band.ts` picks a size from the character count alone — it has to, because
// it runs before layout. This is the other half: once the text is in the DOM
// it *checks* that guess against the room the layout really left, steps the
// size down until it fits, stops at the surface's floor, and reports whether
// even the floor was too big. That last flag is the whole point, and it is
// what a `line-clamp` cannot tell you:
//
//   - reading, text that does not fit is cut to what does and closed with an
//     ellipsis, rather than running under whatever is beneath it;
//   - writing, the keystroke that would overflow the smallest size can simply
//     be refused — the box is full, rather than silently swallowing text
//     nobody can see.
//
// Every measurement here is a synchronous layout read, so callers run this
// from a layout effect: the size settles before the frame is painted and the
// text never flashes at the wrong size.
//
// Two shapes of "it ran out of room", and an app usually wants both. A box
// whose text is a plain block can clamp with `-webkit-line-clamp`, which costs
// no measuring at all — {@link textLineLimit} is the number to give it. A box
// whose text *flows around floats* cannot: line-clamp's line boxes ignore
// floats, so clamped text is pushed clear of them and set in whatever column
// is left. There, the ellipsis goes in the text instead — {@link clipTextToBox}.

/** The line height every fitted surface is assumed to render at. Passed to
 *  {@link textLineLimit}; kept here so a caller's CSS and its arithmetic have
 *  one number between them. */
export const DEFAULT_LINE_HEIGHT = 1.25;

/** The ladder's rung: half a point. Fine enough that the shrink reads as
 *  continuous, coarse enough that the search below stays a handful of
 *  measurements. */
const SHRINK_STEP = 0.5;

function round1(px: number): number {
  return Math.round(px * 10) / 10;
}

/** The height (px) the text may occupy: what is left of its slot from where
 *  the text starts. Zero when there is nothing to measure against yet — an
 *  unmeasurable slot must never be read as "full".
 *
 *  "From where the text starts" is the whole slot for a box that has its slot
 *  to itself, and less than that where the text shares a band with something
 *  above it (a heading, a caption, a floated number). There the text begins
 *  under those, and a measurement that ignored them would hand it room that is
 *  *above* it rather than in front of it — and then refuse the first keystroke
 *  on a box that merely has a heading. */
export function textSlotHeight(el: HTMLElement): number {
  const slot = el.parentElement;
  if (!slot) return 0;
  const style = getComputedStyle(slot);
  const padTop = parseFloat(style.paddingTop) || 0;
  const padding = padTop + (parseFloat(style.paddingBottom) || 0);
  const content = slot.clientHeight - padding;
  const start =
    el.getBoundingClientRect().top -
    (slot.getBoundingClientRect().top + slot.clientTop + padTop);
  return Math.max(0, content - Math.max(0, start));
}

/** Whether the text sticks out of its box sideways: a word longer than the
 *  line it landed on.
 *
 *  Only text that *flows* around something needs to ask. Text making room for
 *  a float is best set with `overflow-wrap: normal`, so a word that does not
 *  fit the shortened line moves down whole rather than being split to fill
 *  three characters beside a float. The price of that rule is the word that
 *  fits no line at all, which hangs out of the box instead of wrapping; this
 *  is how it is caught, so the caller can turn breaking back on for as long as
 *  the text holds such a word. */
export function textOverflowsWidth(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 0.5;
}

/** How many lines of `px` text an `available`-tall slot holds — the number to
 *  hand `-webkit-line-clamp`.
 *
 *  At least one: a truncated first line still says there is something here. */
export function textLineLimit(
  available: number,
  px: number,
  lineHeight = DEFAULT_LINE_HEIGHT,
): number {
  const line = px * lineHeight;
  if (line <= 0) return 1;
  // The epsilon absorbs sub-pixel slot heights — a slot 41.99 px tall holds
  // the same three 14 px lines a 42 px one does.
  return Math.max(1, Math.floor(available / line + 0.02));
}

/** The sizes tried, smallest first: the floor, then every rung up to (and
 *  including) the size the caller asked for. */
export function sizeLadder(startPx: number, minPx: number): number[] {
  const sizes: number[] = [];
  for (let px = minPx; px < startPx - 0.01; px += SHRINK_STEP) {
    sizes.push(round1(px));
  }
  sizes.push(round1(startPx));
  return sizes;
}

export interface TextFitResult {
  /** The size the text was left at, in px. */
  px: number;
  /** Whether it fits the slot at that size. `false` means the floor was still
   *  too big — the caller clamps (reading) or refuses (writing). */
  fits: boolean;
}

/** Size `el`'s text down from `startPx` until it fits `available`, never going
 *  below `minPx`, and leave it at the size it settled on.
 *
 *  Binary search rather than a walk down the ladder: a smaller font never
 *  wraps to *more* lines, so "fits" is monotonic along the ladder and four
 *  measurements cover the eleven rungs of a small box. Callers mutate the
 *  inline font size here and let their next render restate it — what the
 *  renderer writes is the pre-layout guess, this is the correction. */
export function fitTextSize(
  el: HTMLElement,
  available: number,
  startPx: number,
  minPx: number,
): TextFitResult {
  const apply = (px: number) => {
    el.style.fontSize = `${px}px`;
    return el.scrollHeight <= available + 0.5;
  };

  // Nothing to measure against (a slot with no height yet, a hidden screen):
  // leave the guess alone and call it a fit, so typing is never blocked by a
  // measurement that could not be taken.
  if (available <= 0) {
    el.style.fontSize = `${startPx}px`;
    return { px: startPx, fits: true };
  }

  const sizes = sizeLadder(startPx, minPx);
  let lo = 0;
  let hi = sizes.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (apply(sizes[mid]!)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const px = sizes[Math.max(best, 0)]!;
  el.style.fontSize = `${px}px`;
  return { px, fits: best >= 0 };
}

/** Print as much of `text` as fits `available`, ending it in an ellipsis.
 *
 *  The other way text that has run out of room is ended — the one for a box
 *  whose lines flow around floats, where `-webkit-line-clamp` would push the
 *  text clear of the very margins the layout exists to give up.
 *
 *  A binary search over the character count, for the reason {@link fitTextSize}
 *  uses one: more text never sets in fewer lines, so "fits" is monotonic and a
 *  string of any length is settled in a handful of measurements. It writes
 *  through the text node the renderer already put there rather than replacing
 *  it, so the next render can still restate the whole string through the same
 *  node — this is a correction to what is *painted*, not a change to what is
 *  held. */
export function clipTextToBox(
  el: HTMLElement,
  available: number,
  text: string,
): void {
  const node = el.firstChild;
  if (!node || node.nodeType !== 3 /* Node.TEXT_NODE */) return;
  const show = (kept: number): boolean => {
    node.nodeValue = ellipsize(text, kept);
    return el.scrollHeight <= available + 0.5;
  };

  let lo = 0;
  let hi = text.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (show(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // The search's last measurement is not necessarily the one that fit, so the
  // winner is written back — without measuring it again. Text where nothing
  // fits, not even the first character, is left as the ellipsis alone: a box
  // with something in it never looks empty.
  node.nodeValue = ellipsize(text, Math.max(best, 0));
}

/** `text` cut to `kept` characters and closed with an ellipsis, with any space
 *  the cut left hanging trimmed off first — "Supper …" rather than
 *  "Supper  …".
 *
 *  Cutting mid-word is deliberate: a whole word dropped to keep the ellipsis
 *  tidy is a word of the text nobody can see. */
export function ellipsize(text: string, kept: number): string {
  if (kept >= text.length) return text;
  return `${text.slice(0, kept).replace(/\s+$/u, "")}…`;
}
