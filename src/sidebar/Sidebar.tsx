// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useId, type CSSProperties, type ReactNode } from "react";

import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import { FloatingButton } from "./FloatingButton.tsx";
import type { MenuButtonPosition } from "./position.ts";
import { useDrawerSwipeClose } from "./useDrawerSwipeClose.ts";

// The responsive navigation *shell* extracted from the notes / checklist
// apps, where it lived as a near-identical `SideMenu` in each. It owns only
// the framing — never the navigation content, which the host passes as
// `children` (its note / checklist list, action bars, footer, …) so the same
// rows render in both variants.
//
// On viewports narrower than the smallest iPad the shell collapses to a single
// floating button the user can drag to either side edge (its resting spot
// persists in the host's settings); pressing it slides the drawer in from that
// same side over a dimmed backdrop. From the smallest iPad up (`pinned`) the
// same panel is instead docked open as a permanent sidebar beside the content
// — no button, no backdrop, no open/close — so wider screens always see the
// navigation. The host decides `pinned` (typically a media query) and lays the
// docked variant out as a flex sibling of the main view; it docks on the same
// edge the floating button rests on.
//
// The host owns the nav *state* (open/position/pinned) — usually a small store
// or context woven together with app concerns the framework knows nothing
// about — and threads it in as props; the shell stays stateless. Closing
// happens three ways: the backdrop (instant tap), Escape, and — when
// `swipeToClose` is set — a finger drag back toward the resting edge. A nav row
// that owns its own horizontal swipe gesture opts out of the drawer swipe by
// tagging itself `data-drawer-swipe-ignore`.
//
// Styling rides on the host's CSS-variable token system (the same
// `bg-surface` / `border-line` / `text-fg` slots the other framework
// components use) and a small set of drawer keyframes (`drawer-panel-left`,
// `drawer-panel-right`, `drawer-backdrop`); see the module README for the
// classes and variables an app must define.

// Pins the `position: fixed` drawer overlay over the same band as the app
// shell. Vertically it tracks `--app-top` / `--app-height` (an app may mirror
// the iOS visual-viewport band into these so the drawer follows the soft
// keyboard); horizontally it stays on the layout viewport so no layer can be
// pushed a sub-pixel past the edge and turn into a sideways pan. The fallbacks
// reproduce a plain `inset: 0` before any such variables are set.
const APP_VIEWPORT_RECT: CSSProperties = {
  top: "var(--app-top, 0px)",
  left: 0,
  width: "100%",
  height: "var(--app-height, 100svh)",
};

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export type SidebarLabels = {
  /** Accessible label for the `<nav>` landmark (both variants). */
  nav: string;
  /** Accessible label for the floating button while the drawer is closed. */
  open: string;
  /** Accessible label for the button while open, and for the backdrop. */
  close: string;
};

export const DEFAULT_SIDEBAR_LABELS: SidebarLabels = {
  nav: "Navigation",
  open: "Open navigation",
  close: "Close navigation",
};

export type SidebarProps = {
  /**
   * Docked permanent sidebar (wide screens) when true; the floating-button
   * drawer otherwise. The host typically derives this from a media query.
   */
  pinned: boolean;
  /** Whether the drawer is open. Ignored when `pinned`. */
  open: boolean;
  /** Toggle the drawer — the floating button's press. */
  onToggle: () => void;
  /** Close the drawer (backdrop tap, Escape, swipe). */
  onClose: () => void;
  /** The floating button's persisted resting position (edge + vertical %). */
  position: MenuButtonPosition;
  /** Persist a new resting position after the user drags the button. */
  onPositionChange: (next: MenuButtonPosition) => void;
  /**
   * Notified while the floating button is mid-drag, so the host can suppress
   * competing global gestures (e.g. pull-to-refresh) for its duration.
   */
  onDraggingChange?: (dragging: boolean) => void;
  /**
   * Render the floating open button. Defaults to true; pass false when the
   * host opens the drawer another way (e.g. an inward edge swipe in a hidden-
   * button PWA).
   */
  showButton?: boolean;
  /**
   * Enable swipe-to-close on the drawer. Off by default; rows that own their
   * own horizontal swipe gestures should tag themselves
   * `data-drawer-swipe-ignore` so the drawer swipe stands down over them.
   */
  swipeToClose?: boolean;
  /**
   * Let the panel itself scroll (`true`, the default → `overflow-y-auto`), or
   * leave overflow to the children when they manage their own scroll region
   * (`false` → `overflow-hidden`, e.g. a fixed header/footer around one
   * scrolling list).
   */
  panelScroll?: boolean;
  /** Override any subset of the accessible strings (defaults are English). */
  labels?: Partial<SidebarLabels>;
  /** The navigation content, rendered inside the docked nav / drawer panel. */
  children: ReactNode;
};

export function Sidebar({
  pinned,
  open,
  onToggle,
  onClose,
  position,
  onPositionChange,
  onDraggingChange,
  showButton = true,
  swipeToClose = false,
  panelScroll = true,
  labels,
  children,
}: SidebarProps) {
  const text = { ...DEFAULT_SIDEBAR_LABELS, ...labels };
  const drawerId = useId();
  const onRight = position.side === "right";
  const overflow = panelScroll ? "overflow-y-auto" : "overflow-hidden";

  const swipe = useDrawerSwipeClose(position.side, open, onClose);

  // Dismiss on Escape while the drawer is open (the backdrop handles pointer
  // dismissal). Never engaged when pinned — there is no drawer to close.
  useEscapeKey(open && !pinned, onClose);

  // When the drawer opens on a phone (the non-pinned variant), drop focus from
  // any editable element so the soft keyboard it raised slides away. Otherwise
  // a drawer opened mid-type — most visibly via an inward edge swipe, which
  // never moves focus the way a button tap does — slides in behind a keyboard
  // still covering the lower half of the screen. Editable-only: a keyboard
  // user who reached the toggle keeps their focus, and a non-editable element
  // never summons a soft keyboard, so there is nothing to dismiss.
  useEffect(() => {
    if (!open || pinned) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const tag = active.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      active.isContentEditable
    ) {
      active.blur();
    }
  }, [open, pinned]);

  // Pinned: a permanent docked sidebar beside the content. No floating button,
  // no backdrop, no open/close — it's simply always there. The host lays it
  // out as a flex sibling of the main view, so a fixed width and a single
  // inner border (on whichever edge faces the content) is all the framing it
  // needs. It docks on the same side the floating button rests on.
  if (pinned) {
    return (
      <nav
        aria-label={text.nav}
        className={`relative flex h-full w-64 shrink-0 flex-col bg-surface select-none ${overflow} [padding-bottom:max(env(safe-area-inset-bottom),calc(1.25rem_-_var(--density-row-py)))] [padding-top:env(safe-area-inset-top)] ${
          onRight ? "order-last border-l border-line" : "border-r border-line"
        }`}
      >
        {children}
      </nav>
    );
  }

  return (
    <>
      {/* Floating toggle the user can drag to either edge; a plain press
          still toggles the drawer (the shared `FloatingButton` swallows the
          click that tails a real drag, and leaves keyboard activation
          untouched). */}
      {showButton && (
        <FloatingButton
          position={position}
          onPositionChange={onPositionChange}
          onDraggingChange={onDraggingChange}
          onPress={onToggle}
          haspopup="menu"
          expanded={open}
          controls={open ? drawerId : undefined}
          label={open ? text.close : text.open}
        >
          <MenuIcon className="h-5 w-5" />
        </FloatingButton>
      )}

      {open && (
        <div
          className={`fixed z-50 flex ${onRight ? "justify-end" : ""}`}
          style={APP_VIEWPORT_RECT}
          {...(swipeToClose ? swipe.handlers : {})}
        >
          <button
            type="button"
            aria-label={text.close}
            tabIndex={-1}
            onClick={onClose}
            style={swipeToClose ? { opacity: swipe.progress } : undefined}
            className={`drawer-backdrop absolute inset-0 cursor-default bg-black/50 ${
              swipeToClose
                ? `[touch-action:none] ${swipe.animating ? "transition-opacity duration-200" : ""}`
                : ""
            }`}
          />
          <nav
            id={drawerId}
            ref={swipeToClose ? swipe.panelRef : undefined}
            aria-label={text.nav}
            style={
              swipeToClose
                ? { transform: `translateX(${swipe.offset}px)` }
                : undefined
            }
            className={`relative flex w-64 max-w-[80%] flex-col bg-surface shadow-xl select-none ${overflow} [padding-bottom:max(env(safe-area-inset-bottom),calc(1.25rem_-_var(--density-row-py)))] [padding-top:env(safe-area-inset-top)] ${
              swipeToClose
                ? `[touch-action:pan-y] ${swipe.animating ? "transition-transform duration-200" : ""}`
                : ""
            } ${
              onRight
                ? "drawer-panel-right border-l border-line"
                : "drawer-panel-left border-r border-line"
            }`}
          >
            {children}
          </nav>
        </div>
      )}
    </>
  );
}
