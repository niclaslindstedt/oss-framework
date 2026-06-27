// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

// List-box type-ahead: as the user types printable characters, jump to the
// first option whose label starts with the accumulated buffer — the same
// "type to select" behaviour a native `<select>` has. The buffer grows while
// keystrokes stay close together and resets after `timeoutMs` of silence, so
// "apo" typed quickly lands on "Apoteket", but pausing and typing "kr" starts
// a fresh search that lands on "Kronans Apotek". Matching is case-insensitive
// and ignores surrounding whitespace.
//
// Wire the returned `onKeyDown` onto the element that owns keyboard focus for
// the list (a `role="listbox"`, a menu, a radiogroup); on a match the hook
// calls `onMatch(index)` so the caller can move its highlight / focus there.
// Modifier combos (Ctrl / Meta / Alt) and non-printable keys are left
// untouched so arrow / Enter / Escape navigation keeps working — forward those
// keys to your own handlers and call `onKeyDown` only for the rest, or call it
// unconditionally and let it ignore them.
//
// The live buffer is published as `query` (reactive state) so the caller can
// highlight the matched characters on the active option (see
// {@link matchPrefixRange}), and the reset is timer-driven so the highlight
// clears on its own after the pause — the user sees the search "start over"
// without pressing a key. Call `reset()` to drop the buffer eagerly (e.g. when
// arrow navigation takes over, or the surface closes) so a stale highlight
// never lingers.
export function useTypeahead(opts: {
  // One label per option, in option order. Pass `""` for an option that
  // should never be matched (a disabled row, a non-text label); its slot is
  // kept so the matched index stays aligned with your option array.
  labels: readonly string[];
  onMatch: (index: number) => void;
  // Milliseconds of silence after which the buffer resets. Waiting longer than
  // this between keystrokes "starts the search over". Defaults to 3000.
  timeoutMs?: number;
}): {
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  // The current search buffer, or "" while idle. Feed it to
  // {@link matchPrefixRange} on the matched option to emphasise the match.
  query: string;
  // Drop the buffer (and its highlight) immediately.
  reset: () => void;
} {
  const { labels, onMatch, timeoutMs = 3000 } = opts;
  const bufferRef = useRef("");
  const lastAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    bufferRef.current = "";
    setQuery("");
  }, [clearTimer]);

  // Tear down any pending reset timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only printable single characters extend the search; everything else
      // (arrows, Enter, Tab, Backspace, …) falls through to the caller's own
      // handlers.
      if (e.key.length !== 1) return;
      const now = Date.now();
      if (now - lastAtRef.current > timeoutMs) bufferRef.current = "";
      lastAtRef.current = now;

      const next = (bufferRef.current + e.key).toLowerCase();
      // A lone leading space would match nothing useful and steals the
      // keypress — ignore it until there's a real prefix to extend.
      if (next.trim().length === 0) return;
      bufferRef.current = next;

      const idx = labels.findIndex(
        (label) =>
          label.length > 0 && label.trim().toLowerCase().startsWith(next),
      );

      // Publish the buffer so the active option can highlight the match, and
      // (re)arm the silence timer — the same pause that "starts the search
      // over" also clears the highlight, with no extra keypress.
      setQuery(next);
      clearTimer();
      timerRef.current = setTimeout(reset, timeoutMs);

      if (idx !== -1) {
        e.preventDefault();
        onMatch(idx);
      }
    },
    [labels, onMatch, timeoutMs, clearTimer, reset],
  );

  return { onKeyDown, query, reset };
}

// Locate the leading run of `text` that a type-ahead `query` matched, so the
// matched characters can be highlighted on the active option. Mirrors the
// matching rule in {@link useTypeahead}: a case-insensitive prefix match on the
// trimmed label. Returns the `[start, end)` slice indices into the original
// `text`, or `null` when there's nothing to highlight — an empty query, or a
// label that doesn't start with the query once any leading whitespace (which
// the matcher ignores) is skipped.
export function matchPrefixRange(
  text: string,
  query: string,
): { start: number; end: number } | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return null;
  // The matcher compares against `label.trim()`, so skip the same leading
  // whitespace here and map the match back onto the raw text.
  const leading = text.length - text.trimStart().length;
  const body = text.slice(leading);
  if (!body.toLowerCase().startsWith(q)) return null;
  return { start: leading, end: leading + q.length };
}
