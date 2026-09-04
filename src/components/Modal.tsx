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
  // Gate for the swipe-down-to-close gesture on the full-screen mobile sheet
  // (default true). Set false when the card hosts its own pan/zoom touch
  // surface (an image viewer, a map) that would otherwise have to
  // stopPropagation on native touch events to coexist with the gesture.
  // Escape, the backdrop, and any close button keep working.
  swipeToClose?: boolean;
  // An optional bar pinned to the bottom of the card, below the scrolling
  // content (a button row: Cancel / Save, a single Reset). Passing it here
  // instead of as the last child lets the Modal own the iOS-PWA
  // home-indicator clearance beneath it — a bottom safe-area spacer mirroring
  // the top-inset spacer — so a footer only sets its normal padding and never
  // hand-computes `env(safe-area-inset-bottom)`. Colour the footer
  // `bg-surface-3` (like the header) so it reads continuous with the inset
  // spacer below it. Omit for modals with no footer bar.
  footer?: ReactNode;
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
  swipeToClose = true,
  footer,
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
  // pointer never trips it regardless. `swipeToClose={false}` opts a sheet out
  // too, leaving its touch surface entirely to the content (the hook's
  // `enabled` gate skips attaching the listeners). A downward drag that starts
  // on the header, or in content already scrolled to its top, pulls the card
  // with the finger; releasing past the threshold closes. `dragOffset` translates the
  // card and `dragging` gates its transition (live drag tracks 1:1, the
  // snap-back animates). `closing` is true once a release past the threshold
  // commits to dismiss: the card then glides the rest of the way down and fades
  // out before `onClose` unmounts it, instead of vanishing at the finger's last
  // position.
  const {
    offset: dragOffset,
    dragging,
    closing,
  } = useSwipeDownToClose(cardRef, onClose, {
    enabled: open && !centered && swipeToClose,
  });

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

  // The backdrop's paint is var-driven so a theme can restyle it without a
  // prop: `--modal-backdrop-darkness` scales the black scrim's alpha and
  // `--modal-backdrop-blur` frosts the content behind it. The fallbacks keep
  // the classic look (a 50% black scrim, no blur) when neither var is set.
  const backdropAppearance = {
    backgroundColor: "rgb(0 0 0 / var(--modal-backdrop-darkness, 0.5))",
    backdropFilter: "blur(var(--modal-backdrop-blur, 0px))",
    WebkitBackdropFilter: "blur(var(--modal-backdrop-blur, 0px))",
  };
  // Fade the backdrop as the sheet is dragged away so the chrome behind it
  // surfaces in step with the dismiss — clamped so it never fully clears mid
  // gesture. Once the dismiss commits (`closing`), it eases the rest of the way
  // to clear in step with the card gliding out. The fade animates `opacity`,
  // which composes cleanly over the var-driven background colour above.
  const dragProgress = Math.min(dragOffset / 240, 0.6);
  // The exit transition the card and backdrop share once a dismiss commits:
  // glide down (accelerating away, Material's "leaving the screen" easing) while
  // fading out, timed to `SWIPE_DOWN_DISMISS_MS` so it lands exactly as the hook
  // fires `onClose`.
  const exitEase = "cubic-bezier(0.4, 0, 1, 1)";
  const backdropStyle = closing
    ? {
        ...backdropAppearance,
        opacity: 0,
        transition: `opacity ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}`,
      }
    : dragOffset > 0
      ? { ...backdropAppearance, opacity: 1 - dragProgress }
      : backdropAppearance;
  // The card's own offset, when something has moved it. `useDialogDrag` writes
  // the two custom properties from outside the component (it finds the card by
  // its `role`), and they are read into `translate` — a separate CSS property
  // from `transform`, which the swipe-to-close above owns. Two owners of one
  // property is the bug this avoids; unset, it resolves to no movement at all.
  const draggedTranslate =
    "var(--dialog-drag-x, 0px) var(--dialog-drag-y, 0px)";
  const cardStyle = closing
    ? {
        translate: draggedTranslate,
        transform: `translateY(${dragOffset}px)`,
        opacity: 0,
        transition: `transform ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}, opacity ${SWIPE_DOWN_DISMISS_MS}ms ${exitEase}`,
      }
    : dragOffset > 0
      ? {
          translate: draggedTranslate,
          transform: `translateY(${dragOffset}px)`,
          transition: dragging ? "none" : "transform 0.2s ease-out",
        }
      : { translate: draggedTranslate };

  return createPortal(
    <div className={wrapperClass} style={APP_VIEWPORT_RECT}>
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
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
        {footer !== undefined && (
          <>
            {footer}
            {/* iOS PWA safe-area: mirror the top-inset spacer below the footer
                so the footer bar's bg-surface-3 extends into the
                home-indicator strip — the footer keeps its plain padding and
                never hand-computes the inset. Full-screen mobile only; a
                centered card floats clear of the inset. */}
            {!centered && (
              <div
                aria-hidden="true"
                className="h-[env(safe-area-inset-bottom)] shrink-0 bg-surface-3 sm:hidden"
              />
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
