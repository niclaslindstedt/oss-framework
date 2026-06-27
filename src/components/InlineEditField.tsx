// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

// The bare text field at the heart of an in-place editor — the part every
// inline editor (rename a list, rename a checklist item, name a new one) wires
// the same way and is easy to get subtly wrong:
//
// - **Focus + select on mount.** The field only appears on an explicit
//   edit / create action, so it grabs focus the moment it mounts and selects
//   its seed text so the first keystroke replaces it. (An effect, not the
//   a11y-flagged `autoFocus` attribute.)
// - **Commit / cancel with a double-fire guard.** Enter or blur with a
//   non-empty trimmed value commits; Escape (or a blurred-empty value) cancels
//   and keeps the old value. A `committed` latch stops the blur that follows an
//   Enter from firing the callback a second time.
//
// It is *only* the `<input>` — no row, icon, or layout — so a caller drops it
// wherever a label sits (a settings row, a checklist row's label slot) and owns
// the surrounding chrome. {@link InlineEditRow} is the row-shaped shell built on
// it. It takes and returns a plain string, never a domain entity.

export const INLINE_EDIT_FIELD_CLASS =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg-bright outline-none placeholder:text-muted/60";

type Props = {
  /** Seed value; the field mounts focused with this text selected. */
  initial?: string;
  placeholder?: string;
  /** Called with the trimmed value on a non-empty Enter/blur commit. */
  onCommit: (value: string) => void;
  /** Called on Escape, or on a blur/Enter whose trimmed value is empty. */
  onCancel: () => void;
  /** Accessible label for the field; defaults to `placeholder`. */
  ariaLabel?: string;
  /** Utilities for the `<input>`; defaults to the borderless transparent field. */
  className?: string;
};

export function InlineEditField({
  initial = "",
  placeholder,
  onCommit,
  onCancel,
  ariaLabel,
  className = INLINE_EDIT_FIELD_CLASS,
}: Props) {
  const [value, setValue] = useState(initial);
  // A ref, not state — the latch must flip synchronously within one event so
  // the blur that trails an Enter sees it set, and it never needs a re-render.
  const committed = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  function finish() {
    if (committed.current) return;
    committed.current = true;
    const text = value.trim();
    if (text) onCommit(text);
    else onCancel();
  }
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish();
        } else if (e.key === "Escape") {
          e.preventDefault();
          committed.current = true;
          onCancel();
        }
      }}
      className={className}
    />
  );
}
