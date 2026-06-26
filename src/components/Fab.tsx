// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// A floating action button — the round, accented "+" an app pins over its
// content for the primary create action. The component is just the round
// button (a solid accent disc with a high-contrast glyph); the caller
// positions it (e.g. `fixed bottom-6 left-1/2 -translate-x-1/2`) via
// `className` so the framework imposes no layout. `aria-label` is required
// since the button's only content is an icon.

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  "aria-label": string;
  children: ReactNode;
};

export const Fab = forwardRef<HTMLButtonElement, Props>(function Fab(
  { children, className = "", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent text-page-bg shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
});
