// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";

import { isEditableTarget } from "../hooks/keyboardTarget.ts";

// Puts an app shell back where it belongs after the engine moves it.
//
// A phone-shaped PWA is usually exactly one viewport tall with no scrollable
// overflow of its own — the screens scroll inside their own panes, never the
// document. So any document offset is something the engine did, and nothing in
// the app can undo it: it simply stays until the app is relaunched, with the
// whole shell riding up under the status bar.
//
// iOS does exactly that. When the software keyboard opens, WebKit scrolls the
// page to reveal the focused field even on a page that cannot otherwise
// scroll, and undoes it when the field is blurred. If the field is *gone* by
// then — a dialog whose Save button both blurs the field and unmounts the
// dialog in one tick — there is nothing left to scroll back to.
//
// Two defences, and an app wants both: blur before the field is torn down
// (`blurActiveField`, so the ordinary path never strands an offset), and this,
// which pins the shell back whenever the page has drifted and no field is
// focused. The focus check is what keeps it from fighting the keyboard: while
// someone is typing, iOS *should* be holding the field above it.

/** How far the shell has been pushed off the top, from the two ways an engine
 *  can express it: a document scroll, or a visual-viewport offset. */
export function driftPx(scrollY: number, viewportOffsetTop: number): number {
  return Math.max(scrollY, viewportOffsetTop);
}

/** Whether to pin the shell back. Sub-pixel drift is rounding, not a shifted
 *  app, and a focused field owns the viewport while it has it. */
export function shouldPin(drift: number, editing: boolean): boolean {
  return !editing && drift >= 1;
}

/** How long after the triggering event the check runs, in milliseconds. A
 *  frame late on purpose: iOS restores the offset itself in the common case,
 *  and this must not race that, or land mid keyboard animation. */
const SETTLE_MS = 250;

/** Install the guard. Returns a teardown; a no-op outside the browser. */
export function pinShellScroll(): () => void {
  if (typeof window === "undefined") return () => {};

  const check = () => {
    const drift = driftPx(
      window.scrollY,
      window.visualViewport?.offsetTop ?? 0,
    );
    if (shouldPin(drift, isEditableTarget(document.activeElement))) {
      window.scrollTo(0, 0);
    }
  };

  let queued = 0;
  const schedule = () => {
    if (queued) return;
    queued = window.setTimeout(() => {
      queued = 0;
      check();
    }, SETTLE_MS);
  };

  // `focusout` covers a dialog closing over a focused field; the visual
  // viewport's own events cover the keyboard opening and closing, and rotation.
  window.addEventListener("focusout", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  const vv = window.visualViewport;
  vv?.addEventListener("resize", schedule);
  vv?.addEventListener("scroll", schedule);

  return () => {
    if (queued) window.clearTimeout(queued);
    window.removeEventListener("focusout", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.removeEventListener("pageshow", schedule);
    vv?.removeEventListener("resize", schedule);
    vv?.removeEventListener("scroll", schedule);
  };
}

/** {@link pinShellScroll} as a hook — mount once at the root of a shell that
 *  is one viewport tall. Pass `enabled: false` for an app whose document
 *  legitimately scrolls, where a drift is the user's own and pinning it would
 *  be the bug. */
export function useShellScrollPin(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    return pinShellScroll();
  }, [enabled]);
}
