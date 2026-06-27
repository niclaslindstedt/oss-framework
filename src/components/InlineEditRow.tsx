// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type ReactNode } from "react";

// An in-place text editor row — the kind a list swaps in when you rename or
// create one of its items. It owns the parts every inline editor wires the same
// way and is easy to get subtly wrong:
//
// - **Focus + select on mount.** The row only appears on an explicit
//   "rename" / "new" action, so it takes focus the moment it shows and selects
//   its seed text so a keystroke replaces it. (Done with an effect, not the
//   a11y-flagged `autoFocus` attribute.)
// - **Commit / cancel semantics with a double-fire guard.** Enter or blur with
//   a non-empty trimmed value commits; Escape (or a blurred-empty value)
//   cancels and keeps the old value. A `committed` latch stops the blur that
//   follows an Enter from firing the callback a second time.
//
// Everything app-specific stays a prop: the row's own layout (`className`), a
// leading `icon`, an optional `leading` slot (a spacer/chevron for alignment),
// and the commit/cancel callbacks that decide what the value *means*. The
// component takes and returns a plain string — it never sees a domain entity.

const DEFAULT_INPUT_CLASS =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg-bright outline-none placeholder:text-muted/60";

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
  const [value, setValue] = useState(initial);
  const [committed, setCommitted] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  function finish() {
    if (committed) return;
    setCommitted(true);
    const name = value.trim();
    if (name) onCommit(name);
    else onCancel();
  }
  return (
    <div
      className={`flex items-center py-[var(--density-row-py)] ${className}`.trim()}
    >
      {leading}
      {icon != null && <span className={iconClassName}>{icon}</span>}
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
            setCommitted(true);
            onCancel();
          }
        }}
        className={inputClassName}
      />
    </div>
  );
}
