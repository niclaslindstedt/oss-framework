// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Inline SVG glyph set. A self-contained, dependency-free icon family —
// no `lucide-react`, no asset imports — so an app can paint a consistent
// set of marks straight from the framework. Every glyph takes a
// `className` and nothing else, so callers drive size and colour through
// utility classes; the marks stroke (or fill) with `currentColor`, so
// `text-*` colours flow straight through.
//
// Paths are traced from Lucide's 24×24 grid (the disclosure marks ride a
// tighter 16×16 grid) so the whole set shares one weight. Every glyph is a
// thin wrapper over the shared `<Glyph>` shell, which owns the `<svg>`
// chrome (viewBox, stroke defaults, `aria-hidden`) so a new mark is one
// `path` rather than a copy of the boilerplate.

import type { ReactNode } from "react";

export type IconProps = { className?: string };

type GlyphProps = IconProps & {
  // SVG user-space grid. Defaults to Lucide's 24×24; the slim disclosure
  // chevrons / check / spinner ride a 16×16 grid for a crisper hairline.
  viewBox?: string;
  strokeWidth?: number;
  // `true` paints the body with `currentColor` instead of stroking it —
  // for solid marks (the heart) rather than outline glyphs.
  filled?: boolean;
  children: ReactNode;
};

// Shared `<svg>` shell. Outline glyphs (the default) stroke with
// `currentColor` and no fill; `filled` glyphs flip to a `currentColor`
// fill and no stroke. `aria-hidden` + `focusable={false}` keep the mark
// out of the accessibility tree — every glyph here is decorative, named
// by the control that wraps it.
function Glyph({
  viewBox = "0 0 24 24",
  strokeWidth = 2,
  filled = false,
  className,
  children,
}: GlyphProps) {
  return (
    <svg
      viewBox={viewBox}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      {children}
    </svg>
  );
}

// --- Disclosure + confirmation (16×16 grid) -------------------------------

/** A check mark — the tick in a {@link Checkbox} and the "selected" cue on
 *  a {@link SelectPicker} option. */
export function CheckIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" strokeWidth={2.4} className={className}>
      <path d="M13 4.5 6.5 11.5 3 8" />
    </Glyph>
  );
}

/** A slim downward chevron — the disclosure caret on a closed dropdown
 *  trigger ({@link SelectPicker}). The thin "v" a native `<select>` shows. */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="m4 6 4 4 4-4" />
    </Glyph>
  );
}

export function ChevronUpIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="m4 10 4-4 4 4" />
    </Glyph>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="m10 4-4 4 4 4" />
    </Glyph>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="m6 4 4 4-4 4" />
    </Glyph>
  );
}

/** An × — the clear button in a {@link ClearableInput} and the close
 *  affordance on a dialog header. */
export function CloseIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Glyph>
  );
}

/** Indeterminate spinner — a 270° arc callers spin with `animate-spin`. */
export function SpinnerIcon({ className }: IconProps) {
  return (
    <Glyph viewBox="0 0 16 16" className={className}>
      <path d="M8 1.5a6.5 6.5 0 1 1-6.5 6.5" />
    </Glyph>
  );
}

// --- Common actions (24×24 grid) ------------------------------------------

export function PlusIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6M14 11v6" />
    </Glyph>
  );
}

/** Two overlapping pages — copy to the clipboard. */
export function CopyIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
    </Glyph>
  );
}

/** A pencil — rename / edit. */
export function PencilIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Glyph>
  );
}

/** A magnifier — the search affordance. */
export function SearchIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Glyph>
  );
}

/** A circular pair of arrows — retry / reload / reconnect. */
export function RefreshIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </Glyph>
  );
}

/** A box with an out-arrow — a link that opens in a new tab. */
export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Glyph>
  );
}

/** A curved arrow looping back to the left — undo. */
export function UndoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
    </Glyph>
  );
}

/** A curved arrow looping back to the right — redo. */
export function RedoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />
    </Glyph>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Glyph>
  );
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </Glyph>
  );
}

// --- Chrome + status (24×24 grid) -----------------------------------------

/** Three stacked bars — the hamburger / menu trigger. */
export function MenuIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Glyph>
  );
}

/** A cog — the settings affordance. */
export function CogIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Glyph>
  );
}

/** A closed padlock — an encrypted / locked surface. */
export function LockIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Glyph>
  );
}

/** A circled question mark — an "about" / help affordance. */
export function HelpCircleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Glyph>
  );
}

/** A four-point sparkle — a "what's new" / delight affordance. */
export function SparklesIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
      <path d="M19 3v4M21 5h-4M5 17v3M6.5 18.5h-3" />
    </Glyph>
  );
}

/** Three labelled sliders — a settings / tuning marker. */
export function SlidersIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </Glyph>
  );
}

/** An artist's palette — an appearance / theme marker. */
export function PaletteIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.5 1.5-1.5H17a5 5 0 0 0 5-5c0-4.4-4.5-8-10-8z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A stacked database cylinder — a storage marker. */
export function DatabaseIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
    </Glyph>
  );
}

/** A solid heart — a "made with care" / favourite mark. */
export function HeartIcon({ className }: IconProps) {
  return (
    <Glyph filled className={className}>
      <path d="M12 21s-7.5-4.6-10-9.3C.6 9 1.6 5.5 4.8 4.6 7 4 9 5 10 6.7 11 5 13 4 15.2 4.6c3.2.9 4.2 4.4 2.8 7.1C19.5 16.4 12 21 12 21z" />
    </Glyph>
  );
}

// --- list / nav (24×24 grid) ----------------------------------------------

/** Six dots — the drag-handle grip on a reorderable row. */
export function GripIcon({ className }: IconProps) {
  return (
    <Glyph filled viewBox="0 0 16 16" className={className}>
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </Glyph>
  );
}

/** A list with a leading check — a checklist / task list. */
export function ChecklistIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="M11 6h10" />
      <path d="M11 12h10" />
      <path d="M11 18h10" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </Glyph>
  );
}

/** A closed folder — a collapsed folder row. */
export function FolderIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 5h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Glyph>
  );
}

/** The open-lid twin of {@link FolderIcon}, shown when a folder is expanded. */
export function FolderOpenIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 5h5l2 2.5h7a1 1 0 0 1 1 1V10" />
      <path d="M3 18.5 5.4 11a1 1 0 0 1 .95-.7H21a1 1 0 0 1 .95 1.32L19.6 18.5a1 1 0 0 1-.95.7H4a1 1 0 0 1-1-.7z" />
    </Glyph>
  );
}

/** An archive box — an archive / put-away affordance. */
export function ArchiveIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </Glyph>
  );
}

/** A counter-clockwise arrow looping out of an archive — restore / unarchive. */
export function RestoreIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Glyph>
  );
}

/** A cloud with a check — a backend that is in sync. */
export function CloudCheckIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" />
      <path d="m9 15 2 2 4-4" />
    </Glyph>
  );
}

/** A plain cloud — names a hosted backend in the sync command centre. */
export function CloudIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" />
    </Glyph>
  );
}

/** A cloud with an alert — a save that failed / a sync that needs attention. */
export function CloudAlertIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 12v4" />
      <path d="M12 20h.01" />
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    </Glyph>
  );
}

/** A struck-through cloud — the backend is unreachable (offline). */
export function CloudOffIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m2 2 20 20" />
      <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
      <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
    </Glyph>
  );
}

/** A cloud with an up-arrow — unsaved local edits waiting to push. */
export function CloudUploadIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 13v8" />
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="m8 17 4-4 4 4" />
    </Glyph>
  );
}

/** A shield — the "off" twin of {@link LockIcon} for an at-rest encryption
 *  state that is disabled. */
export function ShieldIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Glyph>
  );
}

/** A scroll of text — fronts a collapsible log / activity panel. */
export function ScrollTextIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 3h11a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V3z" />
      <path d="M21 18a3 3 0 0 1-3 3" />
      <path d="M8 7h7M8 11h7" />
    </Glyph>
  );
}

/** A warning triangle — fronts a destructive confirmation (see
 *  {@link ConfirmDialog}'s `danger` tone). */
export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Glyph>
  );
}

/** A document with text lines — a free-form note / Markdown document, the twin
 *  of {@link ChecklistIcon} for a list that holds prose rather than checkboxes. */
export function NoteIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h7M8 16h7" />
    </Glyph>
  );
}
