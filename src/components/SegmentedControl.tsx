// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

// A segmented control — a horizontal radio group rendered as options in a
// bordered "track" with the active one outlined: a crisp accent border and
// brighter text mark the selection, the rest stay quiet. The common
// alternative to a `<select>` for a small, mutually-exclusive choice (a
// language, a layout, how a menu opens) where every option should stay
// visible. Keyboard- and screen-reader-accessible (`role="radiogroup"` /
// `role="radio"`); strings face the user via each option's `label`, so the
// component stays app-agnostic.
//
// Sizes to its content by default. Pass `fullWidth` to stretch the track
// across its container, splitting the width equally across the options with
// each label centred in its cell.

export type SegmentOption<T extends string> = {
  value: T;
  // What the segment renders — a string is the common case; any `ReactNode`
  // works (a flag glyph + text, an icon, …).
  label: ReactNode;
  disabled?: boolean;
};

type Props<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (next: T) => void;
  // Names the group for assistive tech when no visible label wraps it.
  ariaLabel?: string;
  // Fill the container, splitting the width equally across the options (each
  // centred in its cell). Off by default — the track sizes to its content and
  // won't be stretched by a flex/grid parent.
  fullWidth?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  fullWidth = false,
  className = "",
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`items-center gap-1 rounded-md border border-line bg-surface-2 p-1 ${
        fullWidth ? "flex w-full" : "inline-flex w-fit"
      } ${className}`.trim()}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors ${
              fullWidth ? "flex-1 justify-center" : ""
            } ${
              opt.disabled
                ? "cursor-not-allowed border-transparent text-muted opacity-50"
                : active
                  ? "border-accent bg-accent/10 font-medium text-fg-bright"
                  : "cursor-pointer border-transparent text-muted hover:bg-surface-3 hover:text-fg"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
