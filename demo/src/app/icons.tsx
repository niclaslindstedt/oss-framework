// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ChecklistIcon,
  NoteIcon,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";

import type { ListKind } from "./types.ts";

// A couple of glyphs the app needs that the framework's neutral set doesn't
// ship yet (the framework keeps domain/dev-specific marks app-side). Traced on
// Lucide's 24×24 grid to match the framework family's weight.

// The neutral default mark for a list that carries no custom glyph, keyed off
// its kind — a note document or a checklist tick. This is the app's own domain
// mapping ("what a glyph-less list looks like") and the single source of truth
// for it: the side-menu rows, the appearance popover's header trigger, and that
// popover's glyph-picker "clear" cell all draw it, so the icon a note shows and
// the icon its picker clears back to can never drift apart. The framework's
// `DEFAULT_GLYPH` (a folder) is kind-blind, which is why the app supplies this.
export function DefaultListIcon({
  kind,
  className,
}: {
  kind: ListKind | undefined;
  className?: string;
}) {
  return kind === "note" ? (
    <NoteIcon className={className} />
  ) : (
    <ChecklistIcon className={className} />
  );
}

/** Angle brackets — the Developer surface. */
export function CodeIcon({ className }: IconProps) {
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
      <path d="m8 16-4-4 4-4M16 8l4 4-4 4M14 4l-4 16" />
    </svg>
  );
}

/** A document with text lines — the Logs surface. */
export function ScrollTextIcon({ className }: IconProps) {
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
      <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

/** A bulleted list — the "show all" / overview view toggle. */
export function ListIcon({ className }: IconProps) {
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
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
