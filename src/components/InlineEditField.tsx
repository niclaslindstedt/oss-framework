// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

import { scrollFocusedIntoView } from "./scrollFocusedIntoView.ts";

// The bare text field at the heart of an in-place editor — the part every
// inline editor (rename a list, rename a checklist item, name a new one) wires
// the same way and is easy to get subtly wrong:
//
// - **Focus + select on mount.** The field only appears on an explicit
//   edit / create action, so it grabs focus the moment it mounts and (by
//   default) selects its seed text so the first keystroke replaces it. Pass
//   `selectOnFocus={false}` to instead drop the caret at the end — what a
//   checklist row wants when you tap it to keep typing rather than retype.
//   (An effect, not the a11y-flagged `autoFocus` attribute.) On a touch
//   device it then scrolls itself clear of the soft keyboard, so a field that
//   mounts low on screen (a new row below the last, the bottom add-item
//   composer) animates into view instead of appearing hidden behind the
//   keyboard.
// - **Commit / cancel with a double-fire guard.** Enter or blur with a
//   non-empty trimmed value commits (the `via` argument says which, so a caller
//   can chain a fresh draft only on Enter); Escape (or a blurred-empty value)
//   cancels and keeps the old value. A `committed` latch stops the blur that
//   follows an Enter from firing the callback a second time.
// - **Backspace on an empty field** can hand off to `onBackspaceEmpty` — the
//   caller erases this line and backs editing up into the one above, so holding
//   Backspace walks up a list deleting blank rows.
//
// It is *only* the `<input>` — no row, icon, or layout — so a caller drops it
// wherever a label sits (a settings row, a checklist row's label slot) and owns
// the surrounding chrome. {@link InlineEditRow} is the row-shaped shell built on
// it. It takes and returns a plain string, never a domain entity.

export const INLINE_EDIT_FIELD_CLASS =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg-bright outline-none placeholder:text-muted/60";

type Props = {
  /** Seed value; the field mounts focused with this text (selected by default). */
  initial?: string;
  placeholder?: string;
  /**
   * Called with the trimmed value on a non-empty commit. `via` is `"enter"`
   * when the Enter key committed and `"blur"` when focus left the field — a
   * caller can use it to chain a fresh draft only on Enter.
   */
  onCommit: (value: string, via: "enter" | "blur") => void;
  /** Called on Escape, or on a blur/Enter whose trimmed value is empty. */
  onCancel: () => void;
  /**
   * Backspace was pressed in the already-empty field. Return true if you
   * handled it (e.g. removed this line and moved editing elsewhere) — the field
   * then swallows the keystroke and stands down so the trailing blur doesn't
   * also fire a commit/cancel. Return false (or omit) to let Backspace fall
   * through untouched.
   */
  onBackspaceEmpty?: () => boolean;
  /**
   * Select the seed text on mount (default) so the first keystroke replaces it.
   * Set false to drop the caret at the end instead — the row-edit feel where a
   * tap continues the existing text rather than retyping it.
   */
  selectOnFocus?: boolean;
  /** Accessible label for the field; defaults to `placeholder`. */
  ariaLabel?: string;
  /** Utilities for the `<input>`; defaults to the borderless transparent field. */
  className?: string;
  /**
   * Extra attributes spread onto the `<input>` — the soft-keyboard hints a
   * bare text field can't guess (`autoCapitalize`, `inputMode`, `enterKeyHint`,
   * `spellCheck`, …). Spread before the managed props, so the field's own
   * value/commit/cancel wiring (and `className` / `aria-label`) always wins.
   */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

export function InlineEditField({
  initial = "",
  placeholder,
  onCommit,
  onCancel,
  onBackspaceEmpty,
  selectOnFocus = true,
  ariaLabel,
  className = INLINE_EDIT_FIELD_CLASS,
  inputProps,
}: Props) {
  const [value, setValue] = useState(initial);
  // A ref, not state — the latch must flip synchronously within one event so
  // the blur that trails an Enter sees it set, and it never needs a re-render.
  const committed = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `preventScroll` so focusing the field doesn't trigger the browser's own
    // scroll-into-view, which on a clipped field jerks the whole page.
    el.focus({ preventScroll: true });
    if (selectOnFocus) el.select();
    else {
      const end = el.value.length;
      el.setSelectionRange?.(end, end);
    }
    // On a touch device the soft keyboard slides up over the field the moment it
    // takes focus, so a field low on screen — a row typed below the last, the
    // add-item composer at the bottom of a long list — lands hidden behind it,
    // and you can't see what you type. Once the keyboard has settled, centre the
    // field back into the visible viewport. Gated on a coarse pointer: a
    // precise-pointer device opens no soft keyboard, so recentring an
    // already-visible field there would be a spurious scroll jump. (We suppress
    // the browser's own focus-time reveal above with `preventScroll` because it
    // fires before the keyboard shrinks the viewport, so it under-scrolls.)
    if (window.matchMedia?.("(pointer: coarse)").matches) {
      scrollFocusedIntoView(el);
    }
  }, [selectOnFocus]);
  function finish(via: "enter" | "blur") {
    if (committed.current) return;
    committed.current = true;
    const text = value.trim();
    if (text) onCommit(text, via);
    else onCancel();
  }
  return (
    <input
      {...inputProps}
      ref={ref}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish("blur")}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish("enter");
        } else if (e.key === "Escape") {
          e.preventDefault();
          committed.current = true;
          onCancel();
        } else if (e.key === "Backspace" && value === "" && onBackspaceEmpty) {
          // Erasing an already-empty field: let the caller back editing up into
          // the line above. If it takes it, swallow the key and stand down so
          // the unmount-blur doesn't also fire.
          if (onBackspaceEmpty()) {
            e.preventDefault();
            committed.current = true;
          }
        }
      }}
      className={className}
    />
  );
}
