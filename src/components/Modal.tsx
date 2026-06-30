// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import {
  useSwipeDownToClose,
  SWIPE_DOWN_DISMISS_MS,
} from "../hooks/useSwipeDownToClose.ts";
import { APP_VIEWPORT_RECT } from "./appViewportRect.ts";

// Minimal accessible modal: a dimmed backdrop with a centered card. Closes
// on Escape and backdrop click, locks body scroll while open, and moves
// focus into the card on open / restores it on close.
//
// Rendered through a portal to `document.body` so the overlay escapes any
// ancestor stacking context — a modal opened from inside a sticky header
// (a `z-10` context) would otherwise paint *below* a sibling floating
// button; portaling to the body keeps the `z-50` overlay above every
// app-shell layer.

// A stack of the currently-open modals. Escape only dismisses the one on
// top, so a confirmation dialog opened over another modal swallows the
// Escape that closes it without also tearing down the modal underneath.
// Backdrop clicks need no equivalent guard: the topmost modal's backdrop
// covers the whole viewport, so a click can only ever reach it.
const modalStack: symbol[] = [];

type Props = {
  open: boolean;
  onClose: () => void;
  // id of the heading element that names the dialog (aria-labelledby).
  labelledBy: string;
  // `"alertdialog"` for destructive confirmations so assistive tech
  // announces them as an interruption; defaults to `"dialog"`.
  role?: "dialog" | "alertdialog";
  // The element to focus on open instead of the card. A modal with a text
  // field (search, rename) points this at its input so focus — and, when
  // the open is wrapped in `flushSync` from the tap that opens it, the iOS
  // soft keyboard — lands on the field rather than the non-typing card.
  initialFocusRef?: RefObject<HTMLElement | null>;
  // When true the modal renders as a compact centered card on every
  // viewport size instead of filling the screen on mobile. Use it for
  // short content that opens no soft keyboard — confirmations, pickers —
  // where a full-screen sheet would leave a sea of dead space.
  centered?: boolean;
  // Tailwind max-width class for the card. Only meaningful with `centered`
  // (the default full-screen shell caps its own width). Defaults to
  // `max-w-md`.
  size?: string;
  // Accessible label for the dismissing backdrop button. Inject your app's
  // translated "Close" string; defaults to English `"Close"`.
  closeLabel?: string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  labelledBy,
  role = "dialog",
  initialFocusRef,
  centered = false,
  size = "max-w-md",
  closeLabel = "Close",
  children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const tokenRef = useRef<symbol>(Symbol("modal"));

  // Hold the latest onClose in a ref so the keydown effect can depend on
  // `open` alone. Callers commonly pass an inline arrow (`onClose={() =>
  // …}`) that is a fresh identity every render; keying the effect on it
  // would tear down and re-run on every parent re-render — re-adding the
  // Escape listener and re-running focus, which would steal focus from
  // whatever input the user is typing into and dismiss the soft keyboard.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Swipe-down-to-close, the mobile-sheet dismiss gesture. Only the
  // full-screen mobile layout reads as a sheet, so a centered card (a
  // confirmation, a picker) opts out — and the hook is touch-only, so a desktop
  // pointer never trips it regardless. A downward drag that starts on the
  // header, or in content already scrolled to its top, pulls the card with the
  // finger; releasing past the threshold closes. `dragOffset` translates the
  // card and `dragging` gates its transition (live drag tracks 1:1, the
  // snap-back animates). `closing` is true once a release past the threshold
  // commits to dismiss: the card then glides the rest of the way down and fades
  // out before `onClose` unmounts it, instead of vanishing at the finger's last
  // position.
  const {
    offset: dragOffset,
    dragging,
    closing,
  } = useSwipeDownToClose(cardRef, onClose, { enabled: open && !centered });

  // Focus runs in a layout effect, not a passive one, so it fires
  // synchronously on commit. When the open is dispatched inside `flushSync`
  // from the tap that triggered it, this layout effect therefore runs
  // *within* that user gesture — the only context in which iOS raises the
  // soft keyboard for a programmatic `focus()`. A passive effect (or a
  // `setTimeout` / `requestAnimationFrame`) lands outside the gesture, so
  // the field focuses but the keyboard never appears. Focus the caller's
  // `initialFocusRef` (an input) when given, else the card; restore the
  // prior focus on close.
  useLayoutEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    (initialFocusRef?.current ?? cardRef.current)?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current;
    modalStack.push(token);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only the modal on top of the stack reacts, so Escape peels one
      // layer at a time rather than collapsing every open modal at once.
      if (modalStack[modalStack.length - 1] !== token) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = modalStack.lastIndexOf(token);
      if (i !== -1) modalStack.splice(i, 1);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  // The dimming backdrop is a real <button> so dismiss-on-click carries an
  // interactive role (and a label) without piling event handlers onto a
  // non-interactive element; the dialog itself is a plain focusable
  // container layered above it.
  const wrapperClass = centered
    ? "fixed z-50 flex items-center justify-center p-4"
    : "fixed z-50 flex items-stretch justify-center sm:items-center sm:p-4";
  const cardClass = centered
    ? `relative flex max-h-[85svh] w-full ${size} flex-col overflow-hidden rounded-lg border border-line bg-surface text-fg shadow-xl outline-none`
    : "relative flex h-full w-full flex-col overflow-hidden bg-surface text-fg shadow-xl outline-none sm:h-[min(90svh,42rem)] sm:max-w-3xl sm:rounded-lg sm:border sm:border-line";

  // Fade the backdrop as the sheet is dragged away so the chrome behind it
  // surfaces in step with the dismiss — clamped so it never fully clears mid
  // gesture. Once the dismiss commits (`closing`), it eases the rest of the way
  // to clear in step with the card gliding out.
  const dragProgress = Math.min(dragOffset / 240, 0.6);
  // The exit transition the card and backdrop share once a dismiss commits:
  // glide down (accelerating away, Material's "leaving the screen" easing) while
  // fading out, timed to `SWIPE_DOWN_DISMISS_MS` so it lands exactly as the hook
  // fires `onClose`.
  const exitEase = "cubic-bezier(0.4, 0, 1, 1)";
  const backdropStyle = closing
    ? {
        opacity: 0,
        transition: `opacity ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}`,
      }
    : dragOffset > 0
      ? { opacity: 1 - dragProgress }
      : undefined;
  const cardStyle = closing
    ? {
        transform: `translateY(${dragOffset}px)`,
        opacity: 0,
        transition: `transform ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}, opacity ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}`,
      }
    : dragOffset > 0
      ? {
          transform: `translateY(${dragOffset}px)`,
          transition: dragging ? "none" : "transform 0.2s ease-out",
        }
      : undefined;

  return createPortal(
    <div className={wrapperClass} style={APP_VIEWPORT_RECT}>
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
        style={backdropStyle}
      />
      <div
        ref={cardRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cardClass}
        style={cardStyle}
      >
        {/* iOS PWA safe-area: the full-screen mobile layout reaches the top
            of the viewport, so reserve room for the status bar / Dynamic
            Island above the header. Coloured to match the modal headers
            (bg-surface-3) so it reads as an extension of the header bar.
            Centered cards float clear of the inset, so they skip it. */}
        {!centered && (
          <div
            aria-hidden="true"
            className="h-[env(safe-area-inset-top)] shrink-0 bg-surface-3 sm:hidden"
          />
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
