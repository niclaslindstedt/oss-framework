// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type PointerEvent } from "react";

// Swipe-to-reveal / swipe-to-act gesture for a list row. It arms on a dominant
// horizontal drag past a small threshold and drives a live transform. Each side
// of the row is configurable independently — a left swipe and a right swipe can
// each either:
//
//   • REVEAL → latch the foreground open to uncover an action strip behind it
//              (e.g. rename / delete buttons) — a deliberate two-step, so a
//              destructive tap is never a single flick.
//   • COMMIT → fire a callback once the drag passes the threshold; the
//              foreground slides off and the caller drops the row on the next
//              render (e.g. archive).
//
// The classic shape both source apps shipped — left reveals a trailing strip,
// right commits (archive / dismiss) — is the default: `useRowSwipe(onDismiss)`
// gives a left reveal (`actionWidth` wide) and a right commit firing
// `onDismiss`. Pass `options.leading` / `options.trailing` to choose each
// side's behaviour explicitly (and so build a left-commit or a right-reveal).
//
// The caller spreads `handlers` onto the sliding foreground element and applies
// `translateX(offset)`, with `animating` gating the CSS transition so only the
// settle / slide-off animates, not the live drag. The elements behind the
// foreground hold the revealed strips (the trailing one bared by `offset < 0`,
// the leading one by `offset > 0`).
//
// Extracted from the `notes` and `checklist` apps, where this hook was
// byte-identical bar comments — a clean shared-verbatim migration; the app
// pixel thresholds (strip width, latch / commit distances) stay overridable.

// What one side of the row does when a swipe its way passes the threshold.
export type RowSwipeSide =
  | {
      // Latch the foreground open to uncover an action strip behind it.
      intent: "reveal";
      // How far the foreground rests open — match the strip's width. Falls back
      // to `options.actionWidth` (default 96).
      width?: number;
    }
  | {
      // Slide the foreground off and fire `onCommit` after `dismissMs`.
      intent: "commit";
      onCommit: () => void;
    };

export interface RowSwipeOptions {
  // Default rest width (px) for a `reveal` side that doesn't set its own, and
  // the width of the legacy trailing reveal. Default 96.
  actionWidth?: number;
  // Swipe distance that latches a `reveal` side open. Default 48.
  openAt?: number;
  // Swipe distance that fires a `commit` side. Default 96.
  dismissAt?: number;
  // Movement before the gesture commits to a horizontal vs. vertical axis.
  // Default 8.
  axisLock?: number;
  // How long the slide-off animation runs before a commit fires, in ms. Keep it
  // in step with the caller's CSS transition. Default 180.
  dismissMs?: number;
  // The right-swipe side (revealed / committed as `offset` goes positive).
  // Defaults to a commit firing the hook's `onDismiss`, or nothing if none was
  // passed.
  leading?: RowSwipeSide;
  // The left-swipe side (revealed / committed as `offset` goes negative).
  // Defaults to a reveal `actionWidth` wide (the trailing action strip).
  trailing?: RowSwipeSide;
}

const DEFAULTS = {
  actionWidth: 96,
  openAt: 48,
  dismissAt: 96,
  axisLock: 8,
  dismissMs: 180,
} as const;

export interface RowSwipe {
  offset: number;
  animating: boolean;
  // Whether a reveal side is currently latched open (either direction).
  open: boolean;
  // Which side is latched open, or `null` when the row sits closed — lets the
  // caller mark the right strip visible / `aria-hidden`.
  openSide: "leading" | "trailing" | null;
  close: () => void;
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClickCapture: (e: React.MouseEvent) => void;
  };
}

export function useRowSwipe(
  onDismiss?: () => void,
  options: RowSwipeOptions = {},
): RowSwipe {
  const ACTION_W = options.actionWidth ?? DEFAULTS.actionWidth;
  const OPEN_AT = options.openAt ?? DEFAULTS.openAt;
  const DISMISS_AT = options.dismissAt ?? DEFAULTS.dismissAt;
  const AXIS_LOCK = options.axisLock ?? DEFAULTS.axisLock;
  const DISMISS_MS = options.dismissMs ?? DEFAULTS.dismissMs;

  // Resolve each side. When the caller drives either side explicitly, an
  // omitted side is simply off. Only the bare legacy call — no per-side options
  // — falls back to the classic shape: a trailing reveal (left) and, when
  // `onDismiss` is wired, a leading commit (right).
  const usingSides =
    options.leading !== undefined || options.trailing !== undefined;
  const trailing: RowSwipeSide | undefined =
    options.trailing ?? (usingSides ? undefined : { intent: "reveal" });
  const leading: RowSwipeSide | undefined =
    options.leading ??
    (usingSides
      ? undefined
      : onDismiss
        ? { intent: "commit", onCommit: onDismiss }
        : undefined);

  // Flatten the resolved sides into primitives + callback refs, so the pointer
  // handlers below depend only on stable values (and not on the side objects,
  // which the caller may rebuild every render).
  const trailingReveal = trailing?.intent === "reveal";
  const trailingCommit = trailing?.intent === "commit";
  const leadingReveal = leading?.intent === "reveal";
  const leadingCommit = leading?.intent === "commit";
  const hasTrailing = trailing !== undefined;
  const hasLeading = leading !== undefined;
  const trailingW = trailingReveal ? (trailing!.width ?? ACTION_W) : 0;
  const leadingW = leadingReveal ? (leading!.width ?? ACTION_W) : 0;

  const trailingCommitRef = useRef<(() => void) | undefined>(undefined);
  const leadingCommitRef = useRef<(() => void) | undefined>(undefined);
  trailingCommitRef.current = trailingCommit
    ? (trailing as { onCommit: () => void }).onCommit
    : undefined;
  leadingCommitRef.current = leadingCommit
    ? (leading as { onCommit: () => void }).onCommit
    : undefined;

  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [openSide, setOpenSide] = useState<"leading" | "trailing" | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "h" | "v">("none");
  const dx = useRef(0);
  const dragged = useRef(false);
  const wasOpen = useRef<"leading" | "trailing" | null>(null);
  const pointerId = useRef<number | null>(null);

  const close = useCallback(() => {
    setAnimating(true);
    setOffset(0);
    setOpenSide(null);
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      axis.current = "none";
      dx.current = 0;
      dragged.current = false;
      wasOpen.current = openSide;
      setAnimating(false);
    },
    [openSide],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (pointerId.current !== e.pointerId) return;
      const mx = e.clientX - startX.current;
      const my = e.clientY - startY.current;
      if (axis.current === "none") {
        if (Math.abs(mx) < AXIS_LOCK && Math.abs(my) < AXIS_LOCK) return;
        axis.current = Math.abs(mx) > Math.abs(my) ? "h" : "v";
        if (axis.current === "h")
          e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (axis.current !== "h") return;
      e.preventDefault();
      dragged.current = true;
      const rest =
        wasOpen.current === "trailing"
          ? -trailingW
          : wasOpen.current === "leading"
            ? leadingW
            : 0;
      let next = rest + mx;
      // Bound each direction so the drag feels anchored: a reveal side
      // rubber-bands past its rest width, a side with no action rubber-bands
      // from rest, and a commit side follows the finger freely so it can fly
      // off.
      if (next < 0) {
        if (trailingReveal) {
          if (next < -trailingW) next = -trailingW + (next + trailingW) * 0.3;
        } else if (!hasTrailing) {
          next *= 0.3;
        }
      } else if (next > 0) {
        if (leadingReveal) {
          if (next > leadingW) next = leadingW + (next - leadingW) * 0.3;
        } else if (!hasLeading) {
          next *= 0.3;
        }
      }
      dx.current = next;
      setOffset(next);
    },
    [
      AXIS_LOCK,
      trailingReveal,
      leadingReveal,
      hasTrailing,
      hasLeading,
      trailingW,
      leadingW,
    ],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (pointerId.current !== e.pointerId) return;
      pointerId.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      if (axis.current !== "h") {
        axis.current = "none";
        return;
      }
      axis.current = "none";
      const traveled = dx.current;
      const width = e.currentTarget.offsetWidth;
      setAnimating(true);
      // Commit a flick past the threshold first (it slides the row off), then a
      // reveal latch, else settle back closed.
      if (
        traveled <= -DISMISS_AT &&
        trailingCommit &&
        trailingCommitRef.current
      ) {
        setOpenSide(null);
        setOffset(-width);
        window.setTimeout(trailingCommitRef.current, DISMISS_MS);
        return;
      }
      if (traveled >= DISMISS_AT && leadingCommit && leadingCommitRef.current) {
        setOpenSide(null);
        setOffset(width);
        window.setTimeout(leadingCommitRef.current, DISMISS_MS);
        return;
      }
      if (traveled <= -OPEN_AT && trailingReveal) {
        setOpenSide("trailing");
        setOffset(-trailingW);
        return;
      }
      if (traveled >= OPEN_AT && leadingReveal) {
        setOpenSide("leading");
        setOffset(leadingW);
        return;
      }
      setOpenSide(null);
      setOffset(0);
    },
    [
      OPEN_AT,
      DISMISS_AT,
      DISMISS_MS,
      trailingCommit,
      leadingCommit,
      trailingReveal,
      leadingReveal,
      trailingW,
      leadingW,
    ],
  );

  // Swallow the click that trails a drag (so a swipe never activates the row's
  // own controls), and turn a tap on an already-open row into a close.
  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (dragged.current) {
        e.preventDefault();
        e.stopPropagation();
        dragged.current = false;
        return;
      }
      if (wasOpen.current && openSide) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    [openSide, close],
  );

  return {
    offset,
    animating,
    open: openSide !== null,
    openSide,
    close,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}
