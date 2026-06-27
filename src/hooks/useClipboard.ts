// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

// Clipboard write + a short "just copied" acknowledgement, framework-agnostic.
// The pure `copyTextToClipboard` is the reusable jewel; `useClipboard` wraps it
// with the `copied` flag and reset timer a button needs to flash a tick.

/**
 * Best-effort clipboard write: the async Clipboard API where available
 * (a PWA over https), falling back to a hidden-`<textarea>` `execCommand`
 * for the odd insecure-context / older-engine case so the copy still lands.
 * Resolves `true` when the text reached the clipboard, `false` when every
 * path failed (e.g. the user denied permission). Never throws.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface UseClipboardOptions {
  /**
   * Milliseconds the `copied` flag stays `true` after a successful write,
   * letting a button flash a tick before reverting. Defaults to `1500`; pass
   * `0` to keep `copied` latched until the caller invokes `reset()`.
   */
  resetDelay?: number;
}

export interface UseClipboardResult {
  /** Write `text` to the clipboard; resolves to whether it landed. */
  copy: (text: string) => Promise<boolean>;
  /** `true` for `resetDelay` ms after the last successful copy. */
  copied: boolean;
  /** Clear the `copied` flag (and any pending auto-reset) immediately. */
  reset: () => void;
}

/**
 * Copy-to-clipboard with a self-resetting "copied" acknowledgement. Wraps
 * {@link copyTextToClipboard} and owns the reset timer so a button only has to
 * render off `copied`. The timer is cleared on unmount.
 */
export function useClipboard({
  resetDelay = 1500,
}: UseClipboardOptions = {}): UseClipboardResult {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setCopied(false);
  }, [clearTimer]);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyTextToClipboard(text);
      if (ok) {
        setCopied(true);
        clearTimer();
        if (resetDelay > 0) {
          timer.current = setTimeout(() => setCopied(false), resetDelay);
        }
      }
      return ok;
    },
    [clearTimer, resetDelay],
  );

  // Drop a pending reset if the component unmounts mid-flash.
  useEffect(() => clearTimer, [clearTimer]);

  return { copy, copied, reset };
}
