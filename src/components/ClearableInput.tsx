// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { forwardRef, type InputHTMLAttributes } from "react";

import { CloseIcon } from "./icons.tsx";

// Text input with a custom inline clear (×) button. The native input
// chrome is fully restyled (borderless, transparent, themed placeholder);
// the clear button appears only when there's something to clear and keeps
// focus on the input so the soft keyboard stays up on mobile.
//
// The component owns only the field + its clear affordance — it is
// deliberately border-free so a caller can wrap it in whatever field shell
// (a bordered row, a search bar) the surrounding surface uses, passing the
// shell classes through `wrapperClassName`.

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
  /** Text-colour utility for the typed value; defaults to `text-fg-bright`. */
  textClassName?: string;
  /** Accessible label for the clear button; defaults to `"Clear"`. */
  clearLabel?: string;
};

export const ClearableInput = forwardRef<HTMLInputElement, Props>(
  function ClearableInput(
    {
      value,
      onValueChange,
      className,
      wrapperClassName,
      textClassName = "text-fg-bright",
      clearLabel = "Clear",
      type = "text",
      ...rest
    },
    ref,
  ) {
    const canClear = value.length > 0;
    return (
      <div
        className={`relative flex items-center ${wrapperClassName ?? ""}`.trim()}
      >
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`w-full min-w-0 border-0 bg-transparent ${textClassName} outline-none placeholder:text-muted ${canClear ? "pr-7" : ""} ${className ?? ""}`.trim()}
          {...rest}
        />
        {canClear && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={clearLabel}
            // Keep the press from stealing focus so the keyboard stays up.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onValueChange("")}
            className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-fg"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
