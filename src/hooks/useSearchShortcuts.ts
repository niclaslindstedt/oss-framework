// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { isModalOpen } from "./isModalOpen.ts";

// Parameters for {@link useSearchShortcuts}.
export interface SearchShortcutsParams {
  // Open the app's search surface. `seed` is the character that triggered a
  // type-to-open ("m" for a bare M keypress) — pass it to `SearchModal`'s
  // `initialQuery` so the keystroke lands in the field — or `""` for the
  // Cmd/Ctrl+K chord. The reference is kept live via a ref, so an inline
  // closure is fine.
  onOpen: (seed: string) => void;
  // Gates the whole listener (default `true`). Set it `false` to silence the
  // shortcuts while some other surface owns the keyboard.
  enabled?: boolean;
  // Also open when a bare printable character is typed outside any editable
  // element — the "just start typing" gesture (default `true`). Set it `false`
  // to keep only the Cmd/Ctrl+K chord. Only a hardware keyboard produces these
  // events on a non-editable target, so a touch device is unaffected either
  // way.
  typeToOpen?: boolean;
  // Silence the shortcuts while a modal owns the keyboard (default `true`).
  // When on, both gestures no-op as long as any `[aria-modal="true"]` element
  // is mounted — including the search modal itself, so a keypress mid-search
  // can't re-seed the query behind the field's back.
  gateWhileModalOpen?: boolean;
}

// Global "open search" keyboard wiring: Cmd/Ctrl+K from anywhere (the
// deliberate chord — it fires even while an input has focus, like every
// command palette), plus optionally any bare printable character typed while
// nothing editable has focus (type-to-open). The hook owns only the keyboard
// listening and the editable/modal gating; you own the open state and the
// search surface it reveals — pair the `seed` with `SearchModal`'s
// `initialQuery` so the opening keystroke becomes the first character of the
// query.
//
// Type-to-open deliberately ignores keys carrying Ctrl/Cmd/Alt so browser and
// app chords (copy, undo, …) pass through untouched — except the AltGr
// combination (Ctrl+Alt on Windows keyboard layouts), which *types* a
// character ("@" on a Swedish layout) and therefore still opens. Space is
// ignored too: a leading space is never a useful query, and swallowing it
// would break scroll-on-space.
export function useSearchShortcuts(params: SearchShortcutsParams): void {
  const {
    onOpen,
    enabled = true,
    typeToOpen = true,
    gateWhileModalOpen = true,
  } = params;

  // Keep the callback live without re-binding the listener per render — the
  // opener typically closes over app state and is a fresh reference each time.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (gateWhileModalOpen && isModalOpen()) return;

      const isChord =
        (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k";
      if (isChord) {
        e.preventDefault();
        onOpenRef.current("");
        return;
      }

      if (!typeToOpen) return;
      // Only a printable character seeds a query — named keys ("Enter",
      // "ArrowDown", "Dead", …) all have multi-character `key` values.
      if (e.key.length !== 1 || e.key === " ") return;
      const altGr = e.ctrlKey && e.altKey;
      if ((e.ctrlKey || e.metaKey || e.altKey) && !altGr) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      // Swallow the keystroke — it becomes the query seed, not a stray page
      // interaction (e.g. Firefox's quick-find on `/`).
      e.preventDefault();
      onOpenRef.current(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, typeToOpen, gateWhileModalOpen]);
}
