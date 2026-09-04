// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// A square glyph button — the affordance an app's header row, toolbar and
// panel chrome are built out of, where a `Button`'s label and padding would
// not fit and there is a glyph that says it better anyway.
//
// It exists because a glyph on its own is not a button. Three things have to
// come with it and are the same every time: a touch target big enough to hit
// (36 px square — the platform minimum, and the size a thumb finds without
// looking), a name for the people who cannot see the glyph (`label`, which
// becomes both the accessible name and the pointer tooltip), and — for the
// ones that report a state rather than fire and forget — the right ARIA for
// *which kind* of state that is. That last one is what a hand-rolled glyph
// button almost always gets wrong:
//
//   - a **toggle** is `aria-pressed` (`pressed`) — a star, a panel that stays
//     open, a mode that is on;
//   - a **disclosure** is `aria-haspopup` + `aria-expanded` (`expanded`) — a
//     button that opens a menu or a floating panel.
//
// Both are omitted entirely when the caller doesn't pass them, so a plain
// action button never claims to be either.
//
// It wears the `Button` family's chrome — the same border, radius and
// transition, tinted accent while it is on — so a header of these sits beside
// the app's ordinary buttons rather than floating over them as a row of bare
// glyphs. Every standard `<button>` attribute forwards through, and
// `className` is appended, so a caller can size it up or paint it into a
// toolbar without a second component.

/** The look on its own, for the rare caller that has to build the element
 *  itself (a `<label>` wearing a button's clothes, a link). The state classes
 *  are not in it — see {@link ICON_BUTTON_STATE_CLASS}. */
export const ICON_BUTTON_CLASS =
  "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** The two halves of the look that depend on whether the button is currently
 *  on: `[off, on]`. */
export const ICON_BUTTON_STATE_CLASS: readonly [string, string] = [
  "border-line text-muted hover:bg-surface-2 hover:text-fg disabled:hover:bg-transparent",
  "border-accent bg-accent/15 text-accent",
];

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** The button's accessible name, and its pointer tooltip. Required: a glyph
   *  with no name is a button only sighted users have. */
  label: string;
  /** A toggle's state — renders `aria-pressed` and the "on" tint. Leave unset
   *  on a button that simply does something. */
  pressed?: boolean;
  /** A disclosure's state — renders `aria-haspopup="menu"` + `aria-expanded`
   *  and the "on" tint while the menu is open. Leave unset on a button that
   *  opens nothing. */
  expanded?: boolean;
  /** Suppress the tooltip — for a button whose label duplicates text already
   *  beside it. */
  titled?: boolean;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  function IconButton(
    {
      label,
      pressed,
      expanded,
      titled = true,
      className = "",
      type = "button",
      children,
      ...rest
    },
    ref,
  ) {
    const on = pressed === true || expanded === true;
    const merged =
      `${ICON_BUTTON_CLASS} ${ICON_BUTTON_STATE_CLASS[on ? 1 : 0]} ${className}`.trim();
    return (
      <button
        ref={ref}
        type={type}
        data-ui="icon-button"
        aria-label={label}
        title={titled ? label : undefined}
        aria-pressed={pressed}
        aria-haspopup={expanded === undefined ? undefined : "menu"}
        aria-expanded={expanded}
        className={merged}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
