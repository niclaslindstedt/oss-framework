// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import {
  AppearancePicker,
  DEFAULT_APPEARANCE_LABELS,
  type AppearanceLabels,
} from "./AppearancePicker.tsx";
import { DEFAULT_THEME_APPEARANCE, type ThemeAppearance } from "./engine.ts";

// Settings dialog. Wraps the framework's `AppearancePicker` in a self-contained
// accessible overlay (portalled to `document.body`, Escape-to-close via the
// framework's `useEscapeKey`, backdrop click, body-scroll lock, focus
// capture/restore) so an adopting app — or the demo — needs no modal system to
// surface the theme controls. An app that already owns a settings dialog should
// embed `AppearancePicker` in its own chrome instead.
//
// The dialog is controlled and applies live: edits flow straight through
// `onChange`, so a host that feeds the same appearance to `useApplyTheme` sees
// the look update as the user picks. The footer's reset returns every field to
// `DEFAULT_THEME_APPEARANCE` (override the destination via `onReset`).
//
// Visible chrome strings (title, close, reset) and the picker's section labels
// are injectable via `labels`; all default to English.

export type SettingsLabels = AppearanceLabels & {
  // Dialog title shown in the header.
  title: string;
  // Accessible label for the close (×) button.
  close: string;
  // Label for the footer's reset-to-defaults button.
  resetToDefaults: string;
};

export const DEFAULT_SETTINGS_LABELS: SettingsLabels = {
  ...DEFAULT_APPEARANCE_LABELS,
  title: "Settings",
  close: "Close",
  resetToDefaults: "Reset to defaults",
};

type Props = {
  open: boolean;
  onClose: () => void;
  // The appearance the dialog edits — the shape `useApplyTheme` projects.
  appearance: ThemeAppearance;
  // Receives the next appearance on every edit. A host streams this to its own
  // appearance store (and to `useApplyTheme` for a live preview).
  onChange: (next: ThemeAppearance) => void;
  // Footer reset handler. Defaults to resetting to `DEFAULT_THEME_APPEARANCE`
  // via `onChange`. Pass `null` to hide the reset button entirely.
  onReset?: (() => void) | null;
  // Override any subset of the visible strings (defaults are English).
  labels?: Partial<SettingsLabels>;
};

function CogIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// Minimal accessible overlay: a dimmed backdrop with a centered card. Closes on
// Escape (via the framework's `useEscapeKey`) and backdrop click, locks body
// scroll while open, and moves focus into the card on open / restores it on
// close. Portalled to `document.body` so it escapes any ancestor stacking
// context. Mirrors the changelog module's overlay.
function Overlay({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEscapeKey(open, onClose);

  useLayoutEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-line bg-surface text-fg shadow-xl outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SettingsModal({
  open,
  onClose,
  appearance,
  onChange,
  onReset,
  labels,
}: Props) {
  const text = { ...DEFAULT_SETTINGS_LABELS, ...labels };
  const showReset = onReset !== null;
  const handleReset = onReset ?? (() => onChange(DEFAULT_THEME_APPEARANCE));

  return (
    <Overlay open={open} onClose={onClose} labelledBy="settings-title">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="settings-title"
          className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <span className="inline-flex shrink-0 text-accent">
            <CogIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">{text.title}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
        <AppearancePicker
          appearance={appearance}
          onChange={onChange}
          labels={labels}
        />
      </div>

      {/* The full-screen mobile sheet reaches the bottom of the viewport, so
          add the home-indicator / curved-corner safe-area inset *on top of*
          the normal 0.75rem footer padding — keeping the buttons' breathing
          room and lifting them clear of the obscured strip on iOS PWAs.
          Collapses to plain 0.75rem where there is no inset. */}
      {showReset && (
        <footer className="flex shrink-0 items-center justify-start gap-2 border-t border-line bg-surface-3 px-4 pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-surface-3"
          >
            {text.resetToDefaults}
          </button>
        </footer>
      )}
    </Overlay>
  );
}
