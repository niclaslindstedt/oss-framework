// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useClipboard } from "../hooks/useClipboard.ts";
import { CheckIcon, CopyIcon } from "./icons.tsx";

// A bordered glyph button that drops a value on the clipboard and flashes a
// tick. The icon swaps to a check for a beat after a successful copy so the
// action still reads when toasts are off. The robust write (Clipboard API with
// an `execCommand` fallback) and the reset timer live in `useClipboard`; this
// component owns only the affordance, its accessible label, and the seam props
// an app fills in (the value, the labels, success / failure callbacks).

export interface CopyButtonLabels {
  /** Idle `title` / `aria-label`. */
  copy: string;
  /** `title` / `aria-label` shown for a beat after a successful copy. */
  copied: string;
}

const DEFAULT_LABELS: CopyButtonLabels = { copy: "Copy", copied: "Copied" };

export interface CopyButtonProps {
  /**
   * What to put on the clipboard — a ready string, or a (sync or async) getter
   * resolved on click so the snapshot is taken at copy time, not render time.
   */
  value: string | (() => string | Promise<string>);
  /** Override the English `title` / `aria-label` text. */
  labels?: Partial<CopyButtonLabels>;
  /** Milliseconds the tick + "copied" label persist after a copy. Default 1500. */
  resetDelay?: number;
  /** Fired once the text has landed on the clipboard. */
  onCopied?: () => void;
  /** Fired when every clipboard path failed (blocked / insecure context). */
  onError?: () => void;
  /** Extra classes appended to the button (e.g. layout / spacing). */
  className?: string;
}

export function CopyButton({
  value,
  labels,
  resetDelay = 1500,
  onCopied,
  onError,
  className = "",
}: CopyButtonProps) {
  const { copy, copied } = useClipboard({ resetDelay });
  const text = { ...DEFAULT_LABELS, ...labels };

  const onClick = useCallback(async () => {
    const resolved = typeof value === "function" ? await value() : value;
    const ok = await copy(resolved);
    if (ok) onCopied?.();
    else onError?.();
  }, [value, copy, onCopied, onError]);

  const label = copied ? text.copied : text.copy;
  const Icon = copied ? CheckIcon : CopyIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border bg-transparent focus-visible:ring-2 focus-visible:ring-fg focus-visible:outline-none ${
        copied
          ? "border-success/40 text-success"
          : "border-line text-muted hover:bg-surface-2 hover:text-fg"
      } ${className}`.trim()}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
