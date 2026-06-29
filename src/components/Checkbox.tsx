// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { MouseEvent } from "react";

import { CheckIcon } from "./icons.tsx";

// Accessible custom checkbox. The native input is visually hidden
// (`sr-only`) but still receives focus, fires change events, and is
// announced by screen readers; a sibling {@link CheckboxGlyph} renders the
// visual, driven by the controlled `checked` prop. The native checkbox
// chrome is never shown — the drawn box follows the theme (`accent` when
// checked, `muted` border otherwise).

// The drawn box only — a purely presentational (`aria-hidden`) square that
// fills with the `accent` and shows its tick when `checked`, and carries a
// `muted` border otherwise. Split out from {@link Checkbox} so a non-interactive
// caller can paint the same mark it does: a menu's "check all" / "uncheck all"
// rows, a read-only summary, a disabled preview. The box follows the theme's
// control corner (`--control-radius`) just like the interactive control.
//
// `size` shrinks only the drawn square (and its tick), not any touch target —
// `"sm"` reads a notch smaller, e.g. against a row of smaller-font menu items.
// Extra `className` layers on (the interactive control passes its focus ring).
export function CheckboxGlyph({
  checked,
  size = "md",
  className,
}: {
  checked: boolean;
  size?: "md" | "sm";
  className?: string;
}) {
  const boxSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const tickSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const tone = checked ? "border-accent bg-accent" : "border-muted";
  return (
    <span
      aria-hidden
      // Corner shape follows the theme's control style via `--control-radius`
      // (square / rounded / circle); falls back to the rounded look when the
      // theme engine isn't driving the var.
      style={{ borderRadius: "var(--control-radius, 0.25rem)" }}
      className={`flex ${boxSize} shrink-0 items-center justify-center border-2 ${tone} text-page-bg transition-colors ${className ?? ""}`.trim()}
    >
      <CheckIcon
        className={`${tickSize} ${checked ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Accessible label — the visible label usually lives outside the
  // control, so the checkbox carries its own name for screen readers.
  ariaLabel: string;
  className?: string;
  /**
   * Optional press hook on the control. A list-row editor uses it to
   * `preventDefault()` the press so tapping the checkbox doesn't blur an
   * open inline field (which would commit and close the editor) — iOS
   * doesn't focus the label on tap, so the field would otherwise lose
   * focus.
   */
  onMouseDown?: (e: MouseEvent<HTMLLabelElement>) => void;
  /**
   * Visual size of the box itself — **not** the touch target, which the
   * caller sizes via padding in `className`. `"sm"` shrinks only the drawn
   * square (and its tick) so a nested item's box reads as smaller than its
   * parent's while staying just as easy to hit.
   */
  size?: "md" | "sm";
};

export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  className,
  onMouseDown,
  size = "md",
}: Props) {
  return (
    // The label wraps a focusable checkbox, so it is interactive in
    // practice; the press hook keeps an open field focused (see `onMouseDown`).
    <label
      onMouseDown={onMouseDown}
      className={`inline-flex shrink-0 cursor-pointer items-center ${className ?? ""}`.trim()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <CheckboxGlyph
        checked={checked}
        size={size}
        className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      />
    </label>
  );
}
