// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useLayoutEffect, useRef, useState } from "react";

import {
  Button,
  DECK_SCROLLER,
  IconButton,
  Section,
  SwipeDeck,
} from "@niclaslindstedt/oss-framework/components";
import {
  ColorMixer,
  contrastingInk,
  hexToHsv,
  hsvToHex,
  type Hsv,
} from "@niclaslindstedt/oss-framework/color";
import {
  clipTextToBox,
  fitTextSize,
  resolveFontPx,
  type SizeBand,
} from "@niclaslindstedt/oss-framework/fit";
import { useHistory } from "@niclaslindstedt/oss-framework/history";
import {
  formatInsets,
  readViewportReport,
} from "@niclaslindstedt/oss-framework/pwa";

import { ChartIcon, ListIcon } from "../icons.tsx";

// The pieces of the framework that are easier to understand by poking at them
// than by reading their signatures: a pager, a mixer, an undo timeline, and
// text sized against a box it cannot leave. Lives in the Developer tab rather
// than in a screen of its own because it is a *kit* preview — nothing here is
// part of the demo app's own domain.

export function KitSections() {
  return (
    <>
      <PagerDemo />
      <FitDemo />
      <MixerDemo />
      <HistoryDemo />
      <ViewportDemo />
    </>
  );
}

// --- SwipeDeck -------------------------------------------------------------

const PAGES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];

function PagerDemo() {
  const [at, setAt] = useState(0);
  const [axis, setAxis] = useState<"x" | "y">("x");
  const page = (rel: -1 | 0 | 1) => PAGES[(at + rel + 70) % PAGES.length]!;
  return (
    <Section title="SwipeDeck">
      <p className="text-xs text-muted">
        A pager: drag and the neighbour follows your finger, then springs into
        place. Nothing here re-renders while you drag — the track's transform is
        written straight to the DOM — and a page turn moves the anchor{" "}
        <em>before</em> it animates, so the render lands in the pause after your
        finger lifts.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant={axis === "x" ? "primary" : "secondary"}
          onClick={() => setAxis("x")}
        >
          Sideways
        </Button>
        <Button
          variant={axis === "y" ? "primary" : "secondary"}
          onClick={() => setAxis("y")}
        >
          Up and down
        </Button>
      </div>
      <div className="h-40 overflow-hidden rounded-md border border-line">
        <SwipeDeck
          itemKey={String(at)}
          axis={axis}
          onPrevious={() => setAt((n) => n - 1)}
          onNext={() => setAt((n) => n + 1)}
          renderChrome={(nav) => (
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-2 py-1">
              <IconButton label="Previous" onClick={nav.previous}>
                ‹
              </IconButton>
              <span className="text-xs text-muted">{page(0)}</span>
              <IconButton label="Next" onClick={nav.next}>
                ›
              </IconButton>
            </div>
          )}
          renderItem={(rel) => (
            <div
              {...DECK_SCROLLER}
              className="flex h-full items-center justify-center text-2xl text-fg"
            >
              {page(rel)}
            </div>
          )}
        />
      </div>
    </Section>
  );
}

// --- fit -------------------------------------------------------------------

const BAND: SizeBand = { maxPx: 22, minPx: 9, startAt: 20, floorAt: 220 };

function FitDemo() {
  const [text, setText] = useState("Type here and watch it shrink.");
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  const guess = resolveFontPx(text.length, BAND, "auto");

  useLayoutEffect(() => {
    const el = ref.current;
    const slot = el?.parentElement;
    if (!el || !slot) return;
    el.textContent = text;
    const room = slot.clientHeight;
    const fit = fitTextSize(el, room, guess, BAND.minPx);
    setFits(fit.fits);
    if (!fit.fits) clipTextToBox(el, room, text);
  }, [text, guess]);

  return (
    <Section title="fit">
      <p className="text-xs text-muted">
        The box below cannot grow. The size is guessed from the text's length
        before layout (so nothing flashes), then measured against the room the
        layout actually left and stepped down until it fits. Once even the floor
        is too big, the text is cut and closed with an ellipsis — and a writing
        surface would refuse the keystroke instead.
      </p>
      <div className="h-20 overflow-hidden rounded-md border border-line bg-surface-2 p-2">
        <div ref={ref} className="leading-tight break-words text-fg" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        rows={2}
        aria-label="Text to fit"
        className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg"
      />
      <p className="text-xs text-muted">
        guess {guess}px · {fits ? "fits" : "clipped — the box is full"}
      </p>
    </Section>
  );
}

// --- color -----------------------------------------------------------------

function MixerDemo() {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv("#4f9cf9"));
  const hex = hsvToHex(hsv);
  return (
    <Section title="ColorMixer">
      <p className="text-xs text-muted">
        A saturation/value field and a hue strip — the arrangement where "the
        same colour but lighter" is a straight line. The value stays HSV
        throughout: a colour with no light in it has no hue left to carry, so a
        hex round trip per pointer move would reset the strip.
      </p>
      <ColorMixer value={hsv} onChange={setHsv} />
      <div className="flex items-center gap-2">
        <span
          className="rounded border border-line px-3 py-1 font-mono text-xs"
          style={{ backgroundColor: hex, color: contrastingInk(hex) }}
        >
          {hex}
        </span>
        <span className="text-xs text-muted">
          the label picks its own ink with <code>contrastingInk</code>
        </span>
      </div>
    </Section>
  );
}

// --- history ---------------------------------------------------------------

function HistoryDemo() {
  const draft = useHistory("");
  return (
    <Section title="useHistory">
      <p className="text-xs text-muted">
        The two stacks behind Cmd/Ctrl+Z, as a piece of state. Each button
        leaves a rung; undo steps back through them and redo comes forward again
        — until you add something else, which forfeits the future the way every
        undo stack anyone has used does. A gesture would instead write through{" "}
        <code>replace</code> and put one rung down at the end, so a whole drag
        is one step back rather than two hundred.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {["red", "green", "blue"].map((word) => (
          <Button
            key={word}
            variant="secondary"
            onClick={() => draft.set((s) => `${s}${s ? " " : ""}${word}`)}
          >
            + {word}
          </Button>
        ))}
        <IconButton label="Undo" disabled={!draft.canUndo} onClick={draft.undo}>
          ↶
        </IconButton>
        <IconButton label="Redo" disabled={!draft.canRedo} onClick={draft.redo}>
          ↷
        </IconButton>
      </div>
      <p className="min-h-5 text-sm text-fg">{draft.value || "—"}</p>
      <p className="text-xs text-muted">
        {draft.timeline.past.length} behind · {draft.timeline.future.length}{" "}
        ahead
      </p>
    </Section>
  );
}

// --- IconButton + viewport -------------------------------------------------

function ViewportDemo() {
  const [starred, setStarred] = useState(false);
  const [open, setOpen] = useState(false);
  const report = readViewportReport();
  return (
    <Section title="IconButton and the viewport report">
      <p className="text-xs text-muted">
        The left button is a <em>toggle</em> (<code>aria-pressed</code>); the
        right one is a <em>disclosure</em> (<code>aria-haspopup</code> +{" "}
        <code>aria-expanded</code>). Both tint while they are on, and a plain
        action button claims neither.
      </p>
      <div className="flex items-center gap-2">
        <IconButton
          label="Star this"
          pressed={starred}
          onClick={() => setStarred((v) => !v)}
        >
          <ChartIcon className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Open the menu"
          expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ListIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <p className="text-xs text-muted">
        And what the device says about this screen — the numbers a safe-area
        layout report should quote rather than guess at:
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">size</dt>
        <dd className="text-fg tabular-nums">
          {report ? `${report.width} × ${report.height}` : "—"}
        </dd>
        <dt className="text-muted">safe area</dt>
        <dd className="text-fg tabular-nums">
          {report ? formatInsets(report.insets) : "—"}
        </dd>
        <dt className="text-muted">display mode</dt>
        <dd className="text-fg">{report?.displayMode ?? "—"}</dd>
      </dl>
    </Section>
  );
}
