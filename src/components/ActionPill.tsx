// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// A floating bar of verbs raised over the thing they act on: one rounded pill,
// split into halves by a hairline seam, hovering above an anchor. It is what a
// long press (or a selection) puts on screen when the actions belong *to* the
// content rather than to a header — copy and paste over a field, cut and
// delete over a selected row.
//
// The pill is **portalled to `document.body`** rather than left inside the
// anchor: an app shell clips its own overflow and whatever paints below the
// anchor covers anything that leaks out, so a bar nested in the content would
// be cut off at exactly the edges it has to hover over. Being out of the tree
// also means a press on it cannot reach the anchor's own gesture handlers
// underneath, which would otherwise read the press as a drag on the content.
//
// It is centred on the **measured** box of the anchor rather than on
// `left: 50%` of the window, because a pinned sidebar offsets the app's column
// sideways and a hard-coded centre drifts into it.

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { DismissBackdrop } from "./DismissBackdrop.tsx";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";

/** How far down from the top of the anchor the bar hovers, in pixels. */
const DEFAULT_GAP_PX = 12;

/** The fill a half carries. Solid, because the pill is the thing in focus. */
export type ActionPillTone = "accent" | "link" | "danger" | "neutral";

const TONE_CLASS: Record<ActionPillTone, string> = {
  accent: "bg-accent text-page-bg",
  link: "bg-link text-page-bg",
  danger: "bg-danger text-page-bg",
  neutral: "bg-surface-3 text-fg",
};

export type PillAction = {
  /** The word on the button. */
  label: string;
  /** An optional glyph, drawn ahead of the label. */
  icon?: ReactNode;
  tone?: ActionPillTone;
  /**
   * Off means the verb has nothing to work on right now — the half dims but
   * stays in place, so the pill never changes shape under the finger.
   */
  disabled?: boolean;
  /** Spoken name, when the label alone doesn't say enough. Defaults to it. */
  ariaLabel?: string;
  /** Tooltip — worth spending on *why* a disabled half is disabled. */
  title?: string;
  onSelect: () => void;
};

export type ActionPillProps = {
  /**
   * The gesture has landed, so the bar has work to do. Drives the fade rather
   * than the mount, so it slides away instead of vanishing.
   */
  open: boolean;
  /** The box the bar centres on and hangs under. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The verbs, left to right. Two or three is the shape this is for. */
  actions: readonly PillAction[];
  /** Spoken name for the group. */
  ariaLabel?: string;
  /** How far down from the anchor's top edge the bar sits. */
  gapPx?: number;
  /** Pressing Escape, or anywhere else, puts the bar away. */
  onDismiss: () => void;
};

export function ActionPill({
  open,
  anchorRef,
  actions,
  ariaLabel = "Actions",
  gapPx = DEFAULT_GAP_PX,
  onDismiss,
}: ActionPillProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useEscapeKey(open, onDismiss);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAt({ x: r.left + r.width / 2, y: r.top + gapPx });
    };
    measure();
    // The anchor's box moves for reasons `resize` never fires on — content
    // growing above it, a taller surface below. So watch the element itself as
    // well as the window. `visualViewport` is the third: a soft keyboard
    // shrinks the visual viewport without resizing the layout.
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    const vv = window.visualViewport;
    window.addEventListener("resize", measure);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
    };
    // `open` is a dependency so the bar re-measures as it appears: the anchor
    // may have grown or shrunk while it was away.
  }, [anchorRef, open, gapPx]);

  return (
    <>
      {/* The next press anywhere else puts the bar away — the gesture is
          transient, and whatever is underneath must not act on the press that
          dismisses it. */}
      {open ? <DismissBackdrop onDismiss={onDismiss} /> : null}
      {createPortal(
        <div
          role="group"
          aria-label={ariaLabel}
          aria-hidden={!open}
          style={at ? { left: `${at.x}px`, top: `${at.y}px` } : undefined}
          // A hairline `gap-px` over the bar's own translucent backdrop is
          // what separates the halves — they read as one pill with a seam
          // rather than as buttons that happen to touch.
          className={`fixed z-[60] flex -translate-x-1/2 touch-none items-center gap-px overflow-hidden rounded-full bg-page-bg/40 shadow-lg transition-all duration-200 select-none ${
            at ? "" : "left-1/2"
          } ${open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={!open || action.disabled}
              onClick={action.onSelect}
              aria-label={action.ariaLabel ?? action.label}
              title={action.title}
              className={`flex cursor-pointer items-center gap-2 px-6 py-3 text-sm font-medium transition-[filter] active:brightness-90 disabled:opacity-40 ${
                TONE_CLASS[action.tone ?? "accent"]
              }`}
            >
              {action.icon}
              <span className="max-w-40 truncate">{action.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
