// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The rendering half of the toast stack (see `toast.ts` for the store): a
// fixed region that paints a `ToastStore`'s stack as dismissible cards.
//
// Behaviour the component owns so an app doesn't have to:
//
// - **Announcement.** The region is `aria-live="polite"`; each toast is a
//   `role="status"` (or `role="alert"` for `danger`), so assistive tech reads
//   a pushed toast without focus ever moving.
// - **Auto-dismiss with pause.** Each toast runs its own countdown from
//   `durationMs`. Hovering the card or moving focus into it (the action or
//   dismiss button) pauses the countdown; leaving resumes it with the time
//   that was left — so a toast never vanishes mid-read or out from under a
//   focused button.
// - **Reduced-motion-safe transitions.** Enter/exit are short
//   opacity/translate transitions; under `prefers-reduced-motion: reduce`
//   the card appears and disappears instantly instead.
// - **The action seam.** A toast pushed with `action` gets a labelled button
//   next to the message; activating it runs `onAction` and dismisses.
//
// Strings: only the dismiss button label is the component's own — injectable
// via `labels` with an English default. The message and action label arrive
// on the toast itself.

import { useCallback, useEffect, useRef, useState } from "react";

import { CloseIcon } from "./icons.tsx";
import {
  useToasts,
  type Toast,
  type ToastKind,
  type ToastStore,
} from "./toast.ts";

/** How long the exit transition runs before the toast leaves the store. */
const EXIT_DURATION_MS = 180;

/** Visible strings the viewport needs. All optional — English defaults are
 *  used for any you omit. */
export type ToastViewportLabels = {
  /** Accessible label for each toast's dismiss (✕) button. Default `"Dismiss"`. */
  dismiss?: string;
};

type Props = {
  /** The store to render — the same object the app pushes into. */
  store: ToastStore;
  labels?: ToastViewportLabels;
  /** Replaces the default fixed bottom-center positioning classes. */
  className?: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Kind → accent classes, all from the existing token vocabulary: the card
// border tints toward the kind's slot and a small dot restates it (color is
// never the only signal — the dot plus `role` carry the kind redundantly).
const KIND_STYLES: Record<ToastKind, { border: string; dot: string }> = {
  info: { border: "border-line", dot: "bg-accent" },
  success: { border: "border-success/40", dot: "bg-success" },
  danger: { border: "border-danger/50", dot: "bg-danger" },
};

/**
 * A pausable one-shot countdown. Runs `onElapsed` once `durationMs` of
 * *unpaused* time has passed; `hold`/`release` are counted, so two overlapping
 * pause reasons (hover + focus) don't double-resume; `stop` cancels for good.
 * A non-positive / non-finite duration never starts (a sticky toast).
 */
function usePausableTimeout(durationMs: number, onElapsed: () => void) {
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;

  const state = useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    remaining: durationMs,
    startedAt: 0,
    holds: 0,
    stopped: false,
  });

  const clearTimer = useCallback(() => {
    const s = state.current;
    if (s.timer !== null) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }, []);

  const start = useCallback(() => {
    const s = state.current;
    if (s.stopped || s.timer !== null) return;
    if (!Number.isFinite(s.remaining) || s.remaining <= 0) return;
    s.startedAt = Date.now();
    s.timer = setTimeout(() => {
      s.timer = null;
      s.stopped = true;
      onElapsedRef.current();
    }, s.remaining);
  }, []);

  const hold = useCallback(() => {
    const s = state.current;
    s.holds += 1;
    if (s.timer === null) return;
    s.remaining -= Date.now() - s.startedAt;
    clearTimer();
  }, [clearTimer]);

  const release = useCallback(() => {
    const s = state.current;
    s.holds = Math.max(0, s.holds - 1);
    if (s.holds === 0) start();
  }, [start]);

  const stop = useCallback(() => {
    state.current.stopped = true;
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    start();
    return clearTimer;
  }, [start, clearTimer]);

  return { hold, release, stop };
}

function ToastCard({
  toast,
  store,
  dismissLabel,
}: {
  toast: Toast;
  store: ToastStore;
  dismissLabel: string;
}) {
  // Enter: mount hidden, flip visible a frame later so the transition runs.
  // Under reduced motion (or with no rAF, e.g. a non-visual test DOM) the
  // card starts — and later leaves — fully visible/instantly.
  const [visible, setVisible] = useState(prefersReducedMotion);
  const [exiting, setExiting] = useState(false);
  const exitingRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) return;
    if (typeof requestAnimationFrame !== "function") {
      setVisible(true);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const beginExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (prefersReducedMotion()) {
      store.dismiss(toast.id);
      return;
    }
    setExiting(true);
    exitTimerRef.current = setTimeout(
      () => store.dismiss(toast.id),
      EXIT_DURATION_MS,
    );
  }, [store, toast.id]);

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const { hold, release, stop } = usePausableTimeout(
    toast.durationMs,
    beginExit,
  );

  const dismiss = () => {
    stop();
    beginExit();
  };

  const kind = KIND_STYLES[toast.kind];
  const shown = visible && !exiting;

  return (
    <div
      role={toast.kind === "danger" ? "alert" : "status"}
      data-kind={toast.kind}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={(e) => {
        // focus/blur bubble in React (focusin/focusout), so this pair tracks
        // focus-within: hold on entry from outside, release on exit to outside.
        if (!e.currentTarget.contains(e.relatedTarget)) hold();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) release();
      }}
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md border ${kind.border} bg-surface-2 px-3 py-2 text-sm text-fg shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${kind.dot}`}
      />
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            dismiss();
          }}
          className="shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-semibold tracking-wide text-accent hover:bg-surface-3"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={dismiss}
        className="-mr-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-fg"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * The fixed region that renders a {@link ToastStore}'s stack. Mount one per
 * store, once, near the app root. The region itself is pointer-transparent —
 * only the cards accept input — and stays mounted while empty so the live
 * region exists before the first announcement.
 */
export function ToastViewport({ store, labels, className }: Props) {
  const toasts = useToasts(store);
  const dismissLabel = labels?.dismiss ?? "Dismiss";

  return (
    <div
      aria-live="polite"
      className={
        className ??
        "pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-4"
      }
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          store={store}
          dismissLabel={dismissLabel}
        />
      ))}
    </div>
  );
}
