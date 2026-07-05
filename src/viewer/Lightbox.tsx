// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../components/icons.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";

// Full-screen lightbox: a dim, edge-to-edge overlay paging through a set of
// items, each supplied as a render seam (`items[].render`) so the framework
// never assumes an image source — an `<img>`, an SVG, a rendered canvas all
// work. Dismissed with Escape, the close button, a backdrop click, or a
// vertical swipe. With several items the overlay is a horizontal gallery:
// swipe (or use the arrow keys / edge buttons) to move between them, with a
// live "n of m" readout and a dot per item so it's clear how many there are
// and where you are. Deliberately NOT the card `Modal` — a lightbox wants
// the whole screen, not a bordered card — but portalled to `document.body`
// for the same stacking-context reasons the Modal is.

/** A vertical drag past this many px dismisses on release. */
const DISMISS_DISTANCE = 90;
/** Pointer travel before a drag locks to an axis. */
const AXIS_LOCK = 10;
// A horizontal drag past this fraction of the viewport width flips to the
// neighbouring item on release; short drags spring back.
const ADVANCE_FRACTION = 0.22;

/** One lightbox page. `render` returns the node to centre in the viewport —
 *  size it with e.g. `max-h-full max-w-full object-contain`. */
export type LightboxItem = {
  render: () => ReactNode;
  /** Accessible name for this item's page. */
  label?: string;
};

/** Visible strings, injectable for i18n — English defaults are used for any
 *  you omit (see {@link DEFAULT_LIGHTBOX_LABELS}). */
export type LightboxLabels = {
  /** Accessible name of the dialog. */
  title: string;
  close: string;
  previous: string;
  next: string;
  /** The "n of m" readout; `index` is 1-based. */
  counter: (index: number, count: number) => string;
  /** Accessible label for a paging dot; `index` is 1-based. */
  goTo: (index: number) => string;
};

export const DEFAULT_LIGHTBOX_LABELS: LightboxLabels = {
  title: "Viewer",
  close: "Close",
  previous: "Previous",
  next: "Next",
  counter: (index, count) => `${index} of ${count}`,
  goTo: (index) => `Go to item ${index}`,
};

type Props = {
  /** The items to page through. */
  items: LightboxItem[];
  /** Which item to open on. */
  initialIndex?: number;
  /** Observe paging (dots, keys, swipes) — the index is internal state. */
  onIndexChange?: (index: number) => void;
  onClose: () => void;
  labels?: Partial<LightboxLabels>;
};

export function Lightbox({
  items,
  initialIndex = 0,
  onIndexChange,
  onClose,
  labels,
}: Props) {
  const l = { ...DEFAULT_LIGHTBOX_LABELS, ...labels };

  useEscapeKey(true, onClose);

  const count = items.length;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)),
  );
  // Live drag offsets: `dragX` slides the gallery track, `dragY` drives the
  // swipe-to-dismiss fade. Only one is ever non-zero (axis-locked below).
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "h" | "v">("none");
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);
  const width = useRef(1);

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), count - 1);
    if (clamped !== index) onIndexChange?.(clamped);
    setIndex(clamped);
  };

  // Arrow keys page the gallery from anywhere while the lightbox is up — a
  // document listener, so paging works without hunting for focus first. The
  // handler lives in a ref so the listener attaches once per gallery, not
  // once per page turn.
  const stepRef = useRef<(delta: number) => void>(() => {});
  stepRef.current = (delta) => go(index + delta);
  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepRef.current(1);
      else if (e.key === "ArrowLeft") stepRef.current(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    width.current = e.currentTarget.offsetWidth || 1;
    axis.current = "none";
    dragged.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (axis.current === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      // A horizontal swipe pages the gallery only when there's more than one
      // item; otherwise every drag is a vertical dismiss.
      const horizontal = Math.abs(dx) > Math.abs(dy) && count > 1;
      axis.current = horizontal ? "h" : "v";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable — the drag still tracks via the move events.
      }
    }
    dragged.current = true;
    if (axis.current === "v") setDragY(dy);
    else if (axis.current === "h") {
      // Resist dragging past the ends so the track feels bounded.
      const atEnd = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
      setDragX(atEnd ? dx * 0.35 : dx);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const settledY = dragY;
    const settledX = dragX;
    const lockedAxis = axis.current;
    start.current = null;
    axis.current = "none";
    setDragY(0);
    setDragX(0);
    if (lockedAxis === "v" && Math.abs(settledY) > DISMISS_DISTANCE) {
      onClose();
    } else if (lockedAxis === "h") {
      const threshold = width.current * ADVANCE_FRACTION;
      if (settledX <= -threshold) go(index + 1);
      else if (settledX >= threshold) go(index - 1);
    }
  };

  // Swallow the click that trails a swipe so a swipe doesn't also fire the
  // backdrop button.
  const onClickCapture = (e: ReactMouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  const dimming = dragY ? 1 - Math.min(Math.abs(dragY) / 320, 0.6) : 1;

  const edgeButtonClass =
    "absolute top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-white/10";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={l.title}
      tabIndex={-1}
      className="fixed inset-0 z-[90] touch-none overflow-hidden bg-black/80 backdrop-blur-sm select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={l.close}
        className="absolute inset-0 cursor-zoom-out bg-transparent"
      />

      {/* The gallery track: all items laid out in a row, shifted so the
          current one is centred. Vertical dismiss drags the track whole. */}
      <div
        className={`pointer-events-none absolute inset-0 flex ${
          dragX || dragY ? "" : "transition-transform duration-200"
        }`}
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${dragX}px), ${dragY}px, 0)`,
          opacity: dimming,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            aria-label={item.label}
            className="flex h-full w-full shrink-0 items-center justify-center p-4"
          >
            <div className="pointer-events-auto flex max-h-full max-w-full items-center justify-center">
              {item.render()}
            </div>
          </div>
        ))}
      </div>

      {/* Count readout + dots + edge paging — only with more than one item. */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label={l.previous}
            className={`${edgeButtonClass} left-3`}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === count - 1}
            aria-label={l.next}
            className={`${edgeButtonClass} right-3`}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-2">
            <span
              aria-live="polite"
              className="rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-medium text-white/90 tabular-nums"
            >
              {l.counter(index + 1, count)}
            </span>
            <div className="pointer-events-auto flex items-center gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={l.goTo(i + 1)}
                  aria-current={i === index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label={l.close}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
