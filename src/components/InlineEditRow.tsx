// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode } from "react";

import {
  INLINE_EDIT_FIELD_CLASS,
  InlineEditField,
} from "./InlineEditField.tsx";

// An in-place text editor row — the kind a list swaps in when you rename or
// create one of its items. It is the row-shaped shell around
// {@link InlineEditField}: the field owns the fiddly behaviour every inline
// editor shares (focus-and-select on mount, Enter/blur-commits-(trimmed)-
// Escape-cancels, and the latch that stops a post-Enter blur from firing the
// callback twice); this row owns the layout around it.
//
// Everything app-specific stays a prop: the row's own layout (`className`), a
// leading `icon`, an optional `leading` slot (a spacer/chevron for alignment),
// and the commit/cancel callbacks that decide what the value *means*. It takes
// and returns a plain string — it never sees a domain entity.

const DEFAULT_INPUT_CLASS = INLINE_EDIT_FIELD_CLASS;

type Props = {
  /** Seed value; the input mounts focused with this text selected. */
  initial?: string;
  placeholder: string;
  /** Called with the trimmed value on a non-empty Enter/blur commit. */
  onCommit: (value: string) => void;
  /** Called on Escape, or on a blur/Enter whose trimmed value is empty. */
  onCancel: () => void;
  /** Leading glyph, wrapped in `iconClassName`. Omit for no icon. */
  icon?: ReactNode;
  /** Slot rendered before the icon — e.g. a chevron-sized alignment spacer. */
  leading?: ReactNode;
  /** Layout utilities for the row (gap + padding); merged after the shared
   *  `flex items-center py-[var(--density-row-py)]` shell. */
  className?: string;
  /** Wrapper utilities for `icon`; defaults to `shrink-0 text-muted`. */
  iconClassName?: string;
  /** Utilities for the `<input>`; defaults to the borderless transparent field. */
  inputClassName?: string;
  /** Accessible label for the field; defaults to `placeholder`. */
  ariaLabel?: string;
};

export function InlineEditRow({
  initial = "",
  placeholder,
  onCommit,
  onCancel,
  icon,
  leading,
  className = "",
  iconClassName = "shrink-0 text-muted",
  inputClassName = DEFAULT_INPUT_CLASS,
  ariaLabel,
}: Props) {
  return (
    <div
      className={`flex items-center py-[var(--density-row-py)] ${className}`.trim()}
    >
      {leading}
      {icon != null && <span className={iconClassName}>{icon}</span>}
      <InlineEditField
        initial={initial}
        placeholder={placeholder}
        ariaLabel={ariaLabel ?? placeholder}
        onCommit={onCommit}
        onCancel={onCancel}
        className={inputClassName}
      />
    </div>
  );
}
