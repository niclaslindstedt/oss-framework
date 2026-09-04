// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useMediaQuery } from "../hooks/useMediaQuery.ts";

// A **pager**: drag along an axis and the neighbouring page follows your
// finger, then springs into place.
//
// This is the gesture an app navigates a sequence with — one screen of a set,
// one month of a year, one record of a list — and it is a different animal
// from the two row-level gestures the framework already ships (`useRowSwipe`
// reveals and commits an action on one row; `useSwipeDownToClose` dismisses a
// sheet). A pager owns a *track* of three panes and the whole choreography of
// moving between them, which is why it is a component rather than a hook.
//
// Everything below is written in terms of the **main** axis (the one pages
// travel on) and the **cross** axis, so one component serves either direction —
// and, more to the point, serves *both at once*: two decks can be nested
// perpendicular to each other (up and down steps the item, left and right
// steps the view of it). A drag belongs to exactly one of the two, and the
// pair have to agree on which without either of them knowing the other exists.
// {@link claim} and `CROSS_BIAS` are what settle that.
//
// The track holds three panes (previous, current, next), each exactly one
// container wide (or tall), and rests at `-100%` so the current one is on
// screen.
//
// Two rules keep the animation smooth, and both are about *when* work happens:
//
//   - **The gesture never re-renders.** A drag writes the track's transform
//     straight to the DOM rather than through state. Rendering three pages on
//     every pointermove costs a third of the frames on a mid-range machine;
//     this way a drag is a single style write per frame and the browser keeps
//     the whole thing on the compositor.
//   - **A page turn swaps first and animates second.** Committing moves the
//     caller's anchor *immediately* and parks the track one pane off, so the
//     page that was on screen is still the one you see; then the track runs
//     home. The render therefore lands in the pause right after your finger
//     lifts, and the ~260 ms that follow are pure compositor work. Animating
//     first and swapping at the end — the obvious order — puts that render
//     exactly where the eye is watching the page settle.

/** Travel along the paging axis before the gesture is the deck's rather than
 *  the content's. Low enough that a deliberate swipe engages immediately, high
 *  enough that a tap with a shaky thumb still reaches what it landed on. */
const AXIS_LOCK_PX = 10;

/** How much more cross-axis than main-axis a drag must be before this deck
 *  gives it up — to a pane's own scrolling, or to a deck paging the other way
 *  round it.
 *
 *  A thumb swiping across a phone travels in an arc, so a plain
 *  `|cross| >= |main|` test hands far too many honest swipes away. The bias
 *  leaves a band around the diagonal that neither deck refuses, which is what
 *  {@link claim} settles: the first to lock keeps it, and since a nested pair
 *  sees the same move innermost-first, that is the inner deck — so put the
 *  gesture the user makes forty times a day on the inside. */
const CROSS_BIAS = 1.4;

/** How much of a drag toward a neighbour that does not exist actually moves. A
 *  page that gives a little and springs back says "there is nothing there"
 *  better than one that ignores the finger. */
const EDGE_RESISTANCE = 0.25;

/** A drag past this share of the page commits even if it ends slowly. */
const COMMIT_FRACTION = 0.22;

/** …and a flick faster than this (px/ms) commits however short it was. */
const COMMIT_VELOCITY = 0.4;

/** Settle duration. Long enough to read as a page turn, short enough that
 *  stepping three pages back does not feel like waiting. */
const SETTLE_MS = 260;

/** Decelerating ease — fast off the finger, gentle into place. */
const SETTLE_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/** Backstop for the `transitionend` that ends a settle. Generous, because the
 *  render that precedes the animation can delay its start on a slow device —
 *  this only cleans up, so firing late costs nothing. */
const SETTLE_TIMEOUT_MS = SETTLE_MS * 2 + 400;

/** The panes, in reading order along the paging axis: previous, current,
 *  next. */
const RELATIVE: readonly (-1 | 0 | 1)[] = [-1, 0, 1];

/** The axis pages travel on: `x` is left/right, `y` is up/down. */
export type DeckAxis = "x" | "y";

/** Where a pane sits relative to the one on screen. */
export type DeckRelative = -1 | 0 | 1;

/** The deck that owns the gesture in flight, or null between gestures.
 *
 *  Module-level because the two decks that have to agree are *nested*, and a
 *  nested pair sees every pointer event twice, innermost first. Each deck
 *  already turns away a drag that is clearly the other's ({@link CROSS_BIAS});
 *  this settles the band in between, where both would otherwise lock and the
 *  content would move in two directions at once. One pointer is down at a
 *  time, so one slot is enough. */
let claim: unknown = null;

/** Where the track sits when nothing is happening: the centre pane on screen.
 *  A percentage transform is of the track's own border box, and the track is
 *  exactly one pane wide *and* tall (its siblings overflow), so the same
 *  `-100%` is one page on either axis. */
function restTransform(axis: DeckAxis): string {
  return axis === "y" ? "translate3d(0, -100%, 0)" : "translate3d(-100%, 0, 0)";
}

/** The track's transform `px` away from {@link restTransform}. */
function trackTransform(axis: DeckAxis, px: number): string {
  if (px === 0) return restTransform(axis);
  return axis === "y"
    ? `translate3d(0, calc(-100% + ${px}px), 0)`
    : `translate3d(calc(-100% + ${px}px), 0, 0)`;
}

/** Whether a scroller has run out of room in the direction a drag is heading:
 *  `main` is the finger's travel along the paging axis, so a positive one
 *  (dragging down, revealing the pane above) needs a scroller already at its
 *  top and a negative one needs it at its bottom.
 *
 *  This is what lets a scrolling list keep the vertical axis it scrolls on and
 *  still page on it: the pane scrolls until it cannot, and the drag that
 *  carries on past the end is the one that turns the page. A pane with no
 *  scroller of its own has nothing to give up, so it is at both ends at once.
 *  The pixel of slack is for fractional scroll offsets, which a zoomed page
 *  and a retina scrollbar both produce. */
function atScrollEnd(scroller: Element | null, main: number): boolean {
  if (!scroller) return true;
  if (main > 0) return scroller.scrollTop <= 0;
  return (
    scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1
  );
}

/** Marks the scrolling element inside a pane of a `scrolls` deck, so the deck
 *  can put it back to the top when the page changes. Spread onto the scroller:
 *  `<div {...DECK_SCROLLER} className="overflow-y-auto">`. */
export const DECK_SCROLLER = { "data-deck-scroller": "" } as const;

/** Marks the row a scroller should open on, when its top is somewhere other
 *  than zero — a list of days marking today's week, so the month you are
 *  living in opens where you are in it rather than at the 1st. Spread onto the
 *  row (`{...DECK_HOME}`), at most one per scroller, and only while the pane
 *  actually has such a row: without it the scroller opens at the very top,
 *  which is what most pages want. Where the row wants to land is the row's own
 *  to say, in `scroll-margin-top`. */
export const DECK_HOME = { "data-deck-home": "" } as const;

/** Marks a scroller that opens at its **end** rather than at its top or at a
 *  row of its own — what a list asks for on a page it was stepped *backwards*
 *  into, so the page you turn back to begins where the page you left ended.
 *  Spread onto the same element as {@link DECK_SCROLLER}; it wins over any
 *  {@link DECK_HOME} row below it, because "the bottom" is not a row's offset
 *  but the scroll's own far end, gutter and all.
 *
 *  Ignored — like every other answer here — on the pane holding the page you
 *  just left, which keeps the offset it already had while it slides out. */
export const DECK_END = { "data-deck-end": "" } as const;

/** Where a scroller's top is. Zero, unless the pane marked a row to open on —
 *  and then that row's offset, less the scroller's own `scroll-padding-top`:
 *  the space its pinned chrome needs kept clear is exactly the space the row
 *  underneath it has to clear. Measured from the rects rather than read off
 *  `offsetTop`, which is relative to whichever ancestor happens to be
 *  positioned rather than to the scroller.
 *
 *  …and less whatever the row itself adds to that clearance, which is CSS's own
 *  word for the same thing one step down (`scroll-margin-top`, and the same
 *  sign the browser gives it: a row asking to land *past* the padding sets a
 *  negative one). Read off the row rather than passed in, so the pane keeps the
 *  whole decision and the deck keeps none of it. */
function homeOffset(scroller: Element): number {
  // As far down as the scroll goes: assigning past the maximum is the
  // browser's own way of saying "the bottom", and it stays right as the pane's
  // own height changes under it.
  if (scroller.hasAttribute("data-deck-end")) return scroller.scrollHeight;
  const home = scroller.querySelector("[data-deck-home]");
  if (!home) return 0;
  const pad = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
  const tuck = parseFloat(getComputedStyle(home).scrollMarginTop) || 0;
  const above =
    home.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  return Math.max(0, above + scroller.scrollTop - pad - tuck);
}

/** Animated stepping, handed to whatever chrome a pane draws so a heading's
 *  arrows turn the page the same way a swipe does. */
export type DeckNav = {
  previous: () => void;
  next: () => void;
};

export type SwipeDeckProps = {
  /** Identity of what the centre pane is showing. A change made from outside
   *  the deck (a "today" button, a jump from a search result, a view switch)
   *  cancels any settle in flight, re-centres the track and puts every pane's
   *  scroller back to the top.
   *
   *  It is the *showing* that is identified, not the position alone: a caller
   *  that means "put me back" changes this even when the position it is on has
   *  not moved. */
  itemKey: string;
  onPrevious: () => void;
  onNext: () => void;
  /** Draws one pane. `rel` is -1/0/1 relative to the current page; only the
   *  `0` pane is interactive. Keep the returned tree cheap to re-render —
   *  better, make it a memoized component with stable props, so a page turn
   *  only renders the one page that is genuinely new. */
  renderItem: (rel: DeckRelative, nav: DeckNav) => ReactNode;
  /** Chrome drawn above the track and left out of the animation: a screen
   *  whose header is the same on every page should not have three copies of it
   *  sliding past each other. It still gets `nav`, so its arrows page the
   *  content the way a swipe does. */
  renderChrome?: (nav: DeckNav) => ReactNode;
  /** Whether the pane scrolls vertically.
   *
   *  The default — false — is a pane that fills exactly one screen: there the
   *  browser is not allowed to claim the gesture on either axis
   *  (`touch-action: none`), so a swipe can never be lost to a rubber-band
   *  scroll of a page that has nowhere to go. A scrolling pane keeps `pan-y`
   *  and leans on the biased axis lock. */
  scrolls?: boolean;
  /** Which way a page turn travels. Defaults to `x`. */
  axis?: DeckAxis;
  /** Whether there is anything on either side to turn to. A sequence that runs
   *  forever leaves both at their default; a row of three with two ends passes
   *  `false` at each, and a drag past an end gives {@link EDGE_RESISTANCE} and
   *  springs back rather than committing to a pane that would be blank. */
  canPrevious?: boolean;
  canNext?: boolean;
  /** Extra classes on the deck's host element. */
  className?: string;
};

type Drag = {
  /** Where the pointer went down, along the paging axis… */
  main: number;
  /** …and across it. */
  cross: number;
  /** The container's length along the paging axis — one page. */
  size: number;
  /** False until the gesture is ours. A drag the content wins is dropped
   *  outright rather than kept in a losing state. */
  locked: boolean;
  /** The scroller the gesture started over, on a deck whose panes scroll:
   *  what decides, at lock time, whether the pane still has room to give the
   *  drag or the deck should take it (see {@link atScrollEnd}). */
  scroller: Element | null;
  /** Last main-axis sample, for the release velocity. */
  sample: number;
  sampleT: number;
  velocity: number;
};

export function SwipeDeck({
  itemKey,
  onPrevious,
  onNext,
  renderItem,
  renderChrome,
  scrolls = false,
  axis = "x",
  canPrevious = true,
  canNext = true,
  className = "",
}: SwipeDeckProps) {
  const vertical = axis === "y";
  /** The pointer's position along the paging axis. */
  const along = (e: { clientX: number; clientY: number }) =>
    vertical ? e.clientY : e.clientX;
  /** …and across it. */
  const across = (e: { clientX: number; clientY: number }) =>
    vertical ? e.clientX : e.clientY;
  const host = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** How far along the paging axis the finger has taken the track from rest.
   *  A ref, not state: the whole point is that dragging renders nothing. */
  const offset = useRef(0);
  /** Set once a gesture becomes a swipe, so the click it ends with does not
   *  also land on whatever was under the finger. */
  const swiped = useRef(false);
  /** True from a committed swipe until its settle lands. New gestures are
   *  turned away while it holds; another page turn is queued instead. */
  const settling = useRef(false);
  /** Set just before we move the anchor ourselves, so the `itemKey` effect can
   *  tell our own page turn from a jump made outside the deck. */
  const stepped = useRef(false);
  /** A page turn asked for while one was still settling. There is no fourth
   *  pane, so the page after next cannot start sliding until the current one
   *  has landed — but dropping the request outright makes a second tap on the
   *  arrow feel like a miss, which is most of what "laggy" means here. Held,
   *  and turned into a page turn the moment the track is home. One deep, last
   *  one wins: two taps get you two pages, while leaning on the arrow paces at
   *  one page turn per settle instead of banking a queue that keeps flying
   *  after you stop. */
  const queued = useRef<-1 | 1 | null>(null);
  /** The current `commit`, so the settle's tail and the stable `nav` below can
   *  reach it without either of them being rebuilt every render. */
  const commitRef = useRef<(direction: -1 | 1) => void>(() => {});
  const timer = useRef<number | undefined>(undefined);

  // Rotates by one per committed step, so the two panes that survive a page
  // turn keep their key — and, with a memoized pane, their rendered tree. The
  // page that slid in was already rendered as the neighbour; only the page
  // that just came into range is new.
  const [rotation, setRotation] = useState(0);
  /** The pane whose scroll offset is genuinely its own after a page turn: it
   *  held this page before the step too, and is currently sliding out. */
  const keepScroll = useRef<number | null>(null);

  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  /** Whether text under the deck can be selected. Turned off for the length of
   *  a locked drag — see the axis lock. */
  const setSelectable = (on: boolean) => {
    const el = host.current;
    if (!el) return;
    el.style.userSelect = on ? "" : "none";
    el.style.webkitUserSelect = on ? "" : "none";
    if (!on) document.getSelection()?.removeAllRanges();
  };

  /** Park the track `px` from rest, immediately. */
  const place = (px: number) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = trackTransform(axis, px);
  };

  /** Run the track home from wherever it currently is. The start value is
   *  flushed first — without that the browser would resolve both ends in one
   *  style pass and there would be nothing to animate. */
  const runHome = () => {
    const el = track.current;
    if (!el) return;
    void el.offsetWidth;
    el.style.willChange = "transform";
    el.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASING}`;
    el.style.transform = restTransform(axis);
    timer.current = window.setTimeout(endSettle, SETTLE_TIMEOUT_MS);
  };

  const endSettle = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    settling.current = false;
    const el = track.current;
    if (el) {
      el.style.transition = "none";
      el.style.willChange = "auto";
    }
    const next = queued.current;
    queued.current = null;
    if (next) commitRef.current(next);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // The settle is over when the track lands, not when a timer says so: the
  // render that precedes a page turn can push the animation's start out on a
  // slow device, and blocking input for a fixed duration from the *commit*
  // would either unblock mid-flight or hold the next swipe long after the page
  // had settled. The timeout in `runHome` is only a backstop for the case
  // where no transition runs at all.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const done = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "transform") endSettle();
    };
    el.addEventListener("transitionend", done);
    return () => el.removeEventListener("transitionend", done);
    // Only refs and the DOM node are touched, so the first `endSettle` is as
    // good as any later one.
  }, []);

  // Once a drag locks to the paging axis the browser must not reclaim it, and
  // it must not keep a gesture of its own running behind ours either.
  //
  // On a scrolling deck `pan-y` would otherwise let a drift along the cross
  // axis start a native scroll mid-swipe, which fires `pointercancel` and drops
  // the page turn. Swallowing the touchmoves while locked keeps the gesture
  // ours, so only the finger's travel along the paging axis is measured.
  //
  // `touch-action: none` looks like it should make that unnecessary on the
  // decks that fill one screen — but it only denies the browser the *scroll*,
  // not the fling it still ends a flick with. A fling in flight arms the
  // engine's tap suppression: the next tap anywhere on the page is read as
  // "stop the fling" and its `click` is never dispatched. So flicking to the
  // next page and then reaching for a header button costs two taps — the first
  // one only cancelled a fling that moved nothing. Preventing the touchmoves
  // ends the browser's gesture with the finger, so the tap after a flick is the
  // tap the user meant.
  //
  // Native listener because it must be non-passive to call `preventDefault`.
  // The cost a non-passive touchmove listener carries — the compositor waiting
  // on the main thread before a scrolled frame — is paid only while something
  // under it actually scrolls.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current?.locked && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  // A deck that pages on the axis its panes scroll on has one more thing to
  // arrange, and it is the browser's rubber band. `overscroll-behavior: none`
  // is what says "there is nothing past the end here": without it iOS bounces
  // the pane instead, and a bounce is a scroll — the engine claims the touch,
  // fires `pointercancel`, and the drag that was meant to turn the page is
  // gone. With it, a finger that reaches the end of the list keeps sending us
  // moves, which is exactly the gesture {@link atScrollEnd} is looking for.
  //
  // Set here rather than in the pane's own classes because it is the *deck's*
  // reason: a list that is not paged on the axis it scrolls on should keep its
  // bounce.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const scrollers = el.querySelectorAll<HTMLElement>("[data-deck-scroller]");
    for (const scroller of scrollers) {
      scroller.style.overscrollBehaviorY = vertical ? "none" : "";
    }
  }, [vertical, scrolls]);

  // The centre page changed. Our own page turn has already placed the track and
  // started its animation; anything else is a jump from outside the deck and
  // lands with no animation at all.
  useLayoutEffect(() => {
    if (stepped.current) {
      stepped.current = false;
      return;
    }
    // Whoever moved the anchor from outside meant *that* page, not the one a
    // queued arrow tap was heading for.
    queued.current = null;
    endSettle();
    offset.current = 0;
    place(0);
    // `itemKey` alone, deliberately. This is the "someone moved the anchor from
    // outside" effect; `place` is in it only because it writes the track, and
    // it counts as reactive only because it reads the paging axis — which is
    // fixed for the life of a deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  // A pane is a reused DOM node — the page inside it swaps, its scroll offset
  // does not. So paging out of a list you had scrolled halfway down would drop
  // you halfway down the neighbouring one, at a row the swipe never showed you:
  // what slid in was that page's *top*. Put every pane whose page actually
  // changed back there in the same batch the anchor moves in, before the
  // browser paints. The one exception is the pane still holding the page you
  // just left: it is on screen, sliding out, and yanking it to the top
  // mid-animation is exactly the flash this is meant to prevent.
  //
  // "The top" is the pane's to define ({@link homeOffset}), and it has to be
  // decided here rather than by the pane itself: this runs after the panes' own
  // layout effects, so a scroll one of them set would be overwritten a moment
  // later by the zero this used to write unconditionally.
  useLayoutEffect(() => {
    if (!scrolls) return;
    const el = host.current;
    const keep = keepScroll.current;
    keepScroll.current = null;
    if (!el) return;
    for (const pane of el.querySelectorAll<HTMLElement>("[data-deck-pane]")) {
      if (keep !== null && pane.dataset.deckPane === String(keep)) continue;
      for (const scroller of pane.querySelectorAll("[data-deck-scroller]")) {
        scroller.scrollTop = homeOffset(scroller);
      }
    }
  }, [itemKey, scrolls]);

  /** Spring back to the current page: the drag did not go far enough. This one
   *  does not block input — nothing changed, so a second try can start before
   *  the first has finished springing. */
  const rest = () => {
    offset.current = 0;
    runHome();
  };

  /** Whether there is a pane that way to turn to. */
  const canStep = (direction: -1 | 1) =>
    direction === 1 ? canNext : canPrevious;

  const commit = (direction: -1 | 1) => {
    // The end of the row. Whatever asked — a drag, a queued step — there is
    // nothing over there, so the track goes back where it was.
    if (!canStep(direction)) {
      if (offset.current !== 0) rest();
      return;
    }
    if (settling.current) {
      queued.current = direction;
      return;
    }
    const el = host.current;
    const size = (vertical ? el?.clientHeight : el?.clientWidth) ?? 0;
    const step = () => (direction === 1 ? onNext() : onPrevious());

    // Where the track has to sit, once the anchor has moved, for the page you
    // are looking at to stay exactly where it is: one pane over, plus whatever
    // the finger had already added.
    const from = direction * size + offset.current;
    offset.current = 0;
    stepped.current = true;
    keepScroll.current = paneKey(rotation, 0);
    setRotation((r) => r + direction);

    if (reducedMotion || size === 0) {
      place(0);
      step();
      return;
    }

    settling.current = true;
    // Order matters, and nothing paints in between: park the track as if the
    // step had already happened, start it home, and only then move the anchor.
    // The re-render that follows leaves the transform alone, so a slow render
    // delays the animation rather than truncating it.
    place(from);
    runHome();
    step();
  };

  commitRef.current = commit;
  // Stable across renders so a memoized pane is not invalidated by its own
  // navigation arrows.
  const nav = useMemo<DeckNav>(
    () => ({
      previous: () => commitRef.current(-1),
      next: () => commitRef.current(1),
    }),
    [],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A fresh gesture is nobody's yet. Set by both decks of a nested pair —
    // they both see this event, and both are writing the same null.
    claim = null;
    if (settling.current || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    // A drag across an open editor is a text selection, not a page turn —
    // leave those gestures alone.
    if (target?.closest("textarea, input, select, [contenteditable='true']")) {
      return;
    }
    const el = host.current;
    const size = (vertical ? el?.clientHeight : el?.clientWidth) ?? 0;
    if (size === 0) return;
    drag.current = {
      main: along(e),
      cross: across(e),
      size,
      locked: false,
      scroller: target?.closest("[data-deck-scroller]") ?? null,
      sample: along(e),
      sampleT: e.timeStamp,
      velocity: 0,
    };
    swiped.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const moved = along(e) - d.main;

    if (!d.locked) {
      const sideways = Math.abs(across(e) - d.cross);
      if (Math.abs(moved) < AXIS_LOCK_PX && sideways < AXIS_LOCK_PX) return;
      // A clearly cross-axis drag is not ours: it belongs to the pane's own
      // scrolling, or to the deck paging the other way round this one.
      if (sideways > Math.abs(moved) * CROSS_BIAS) {
        drag.current = null;
        return;
      }
      if (Math.abs(moved) < AXIS_LOCK_PX) return;
      // …and in the band around the diagonal that neither deck refuses, the
      // one that got here first has it (see {@link claim}).
      if (claim !== null && claim !== host.current) {
        drag.current = null;
        return;
      }
      // Paging up and down over a pane that scrolls up and down: the scroll
      // comes first and the page turn is what is left once the pane has run
      // out. Handing the gesture back here is what keeps a list a list.
      if (vertical && scrolls && !atScrollEnd(d.scroller, moved)) {
        drag.current = null;
        return;
      }
      d.locked = true;
      claim = host.current;
      swiped.current = true;
      const el = track.current;
      if (el) el.style.willChange = "transform";
      clearTimeout(timer.current);
      // A mouse drag is also a text drag: without this, turning the page on a
      // desktop smears a selection highlight across everything it passes over.
      // Dropped at the moment the gesture becomes ours, and given back when the
      // pointer lifts, so ordinary selection still works everywhere else.
      setSelectable(false);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }

    const elapsed = e.timeStamp - d.sampleT;
    if (elapsed > 0) {
      d.velocity = (along(e) - d.sample) / elapsed;
      d.sample = along(e);
      d.sampleT = e.timeStamp;
    }
    // Capped at one page: a long drag reveals the neighbour and no further,
    // because there is no fourth pane behind it. A drag toward a neighbour that
    // does not exist at all gives only a little, and gives it back.
    const travel = Math.max(-d.size, Math.min(d.size, moved));
    offset.current = canStep(travel < 0 ? 1 : -1)
      ? travel
      : travel * EDGE_RESISTANCE;
    place(offset.current);
  };

  /** Ends a locked drag: commit if it went far or fast, spring back if not.
   *  `at` is the pointer's final position along the paging axis. */
  const finish = (d: Drag, at: number) => {
    const moved = Math.max(-d.size, Math.min(d.size, at - d.main));
    const far = Math.abs(moved) > d.size * COMMIT_FRACTION;
    const flicked =
      Math.abs(d.velocity) > COMMIT_VELOCITY &&
      Math.sign(d.velocity) === Math.sign(moved);
    if (far || flicked) commit(moved < 0 ? 1 : -1);
    else rest();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (claim === host.current) claim = null;
    if (!d || !d.locked) return;
    setSelectable(true);
    finish(d, along(e));
  };

  const onPointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (claim === host.current) claim = null;
    if (!d) return;
    setSelectable(true);
    // A cancel after the axis lock means the browser stole a gesture that was
    // already a swipe. Finish it from the last sample rather than snapping
    // back — the finger asked for a page turn.
    if (d.locked) finish(d, d.sample);
    else rest();
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!swiped.current) return;
    // The pointerup that ended the swipe still fires a click on whatever it
    // landed over. Swallow it so paging never activates anything.
    swiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={host}
      data-ui="swipe-deck"
      className={`flex h-full flex-col overflow-hidden ${className}`.trim()}
      // A scrolling pane keeps `pan-y` so the browser still owns the vertical
      // axis before the axis lock decides; a pane that fills one screen has no
      // native gesture worth keeping on either axis, and `none` means the
      // browser can never claim the drag (a claim fires `pointercancel` and
      // eats the page turn — `pan-x` invites exactly that).
      //
      // That holds when the deck pages up and down too, and for the same reason
      // read the other way round: the scroll is the pane's until the pane runs
      // out, so the browser keeps `pan-y` and the deck takes over at the end of
      // the list (`atScrollEnd`, and the `overscroll-behavior` above that keeps
      // the bounce from eating the drag).
      style={{ touchAction: scrolls ? "pan-y" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      {renderChrome && <div className="shrink-0">{renderChrome(nav)}</div>}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          ref={track}
          // One pane wide and tall either way; the other two overflow, along
          // the axis the panes are laid out on.
          className={`flex h-full w-full ${vertical ? "flex-col" : ""}`.trim()}
          // The resting transform is the only one React writes. Every other
          // position — the finger's, the page turn's — is set on this node
          // directly, so no gesture ever costs a render.
          style={{ transform: restTransform(axis) }}
        >
          {RELATIVE.map((rel) => {
            const key = paneKey(rotation, rel);
            return (
              // Keyed by a rotating slot rather than by position: a page turn
              // shifts every page one pane over, and this is what lets the two
              // that were already rendered keep their tree instead of being
              // rebuilt under a position key that never moves.
              <div
                key={key}
                data-deck-pane={key}
                className="h-full w-full shrink-0"
                // The neighbours carry focusable controls; `inert` keeps them
                // out of the tab order and the accessibility tree while they
                // are parked off screen.
                //
                // `true`, not the empty string an attribute would take. `inert`
                // is a real property on `HTMLElement`, so a renderer sets it as
                // one rather than writing the attribute — and `el.inert = ""`
                // is `el.inert = false`, which would park two pages' worth of
                // controls in the tab order and read them out to a screen
                // reader as part of the page.
                {...(rel === 0 ? {} : { inert: true })}
              >
                {renderItem(rel, nav)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The slot a pane occupies, `rel` away from the centre at this rotation.
 *  Three slots cycling means a step re-uses two of them and only the page that
 *  just came into range lands in a fresh one. */
function paneKey(rotation: number, rel: DeckRelative): number {
  return (((rotation + rel) % 3) + 3) % 3;
}
