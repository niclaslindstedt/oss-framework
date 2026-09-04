<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `fit` — text that fits the box it is in

Two halves, because the problem has two.

## Before layout — `band.ts`

A **band** is `[minPx, maxPx]` plus the character counts the ramp runs between.
`resolveFontPx` turns a string's length into a size: short text sits at the top
of the band, long text ramps down to the floor.

```ts
const CELL: SizeBand = { maxPx: 13, minPx: 8, startAt: 12, floorAt: 90 };

<div style={{ fontSize: `${resolveFontPx(text.length, CELL, "auto")}px` }}>
  {text}
</div>;
```

This runs before there is a DOM to measure, which is the point: a first render
that guesses badly and is corrected in a layout effect is a visible flash.

`scaleBand(band, factor)` carries a band along when an app scales its type — a
band is a set of measurements, so it has to be scaled with everything else or
that one piece stays at the measured size while the layout around it grows.

## After layout — `measure.ts`

```ts
useLayoutEffect(() => {
  const el = ref.current;
  if (!el) return;
  const room = textSlotHeight(el);
  const { fits } = fitTextSize(el, room, startPx, band.minPx);
  if (!fits) clipTextToBox(el, room, text);
}, [text, startPx]);
```

`fitTextSize` binary-searches the size ladder (a smaller font never wraps to
_more_ lines, so "fits" is monotonic) and reports whether even the floor was too
big. That flag is the part a `-webkit-line-clamp` cannot give you, and it is
what lets a **writing** surface refuse the keystroke that would overflow instead
of silently swallowing text nobody can see.

Two ways to end text that has run out of room, and which one you want depends
on the box:

| Box                          | End it with                                   |
| ---------------------------- | --------------------------------------------- |
| plain block                  | `-webkit-line-clamp: textLineLimit(room, px)` |
| lines flowing around a float | `clipTextToBox(el, room, text)`               |

Line-clamp's line boxes ignore floats, so clamped text is pushed clear of the
very margins the layout exists to give up; there the ellipsis has to go in the
text instead.
