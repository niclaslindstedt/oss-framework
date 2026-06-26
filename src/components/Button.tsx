// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// Shared button chrome. The native `<button>` is fully restyled through the
// theme token vocabulary (accent / line / surface / danger slots + the
// `--radius-md` corner) so it follows the active theme, and every standard
// `<button>` attribute forwards through. `type` defaults to `"button"` so a
// button inside a `<form>` never submits by accident — pass `type="submit"`
// explicitly when that is wanted.
//
// Four variants cover the common cases:
//   primary    — the accented call-to-action.
//   secondary  — a filled neutral button (a bordered surface fill).
//   ghost      — a borderless/quiet button: text only until hovered.
//   danger     — a destructive action (delete, disconnect, reset).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent/15 font-medium text-accent hover:bg-accent/25",
  secondary: "border-line bg-surface-2 text-fg hover:bg-surface-3",
  ghost: "border-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "border-danger/50 bg-danger/10 text-danger hover:bg-danger/20",
};

const BASE_CLASS =
  "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", children, className = "", type = "button", ...rest },
  ref,
) {
  const merged = `${BASE_CLASS} ${VARIANT_CLASS[variant]} ${className}`.trim();
  return (
    <button ref={ref} type={type} className={merged} {...rest}>
      {children}
    </button>
  );
});
