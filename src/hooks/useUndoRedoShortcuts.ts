// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";

// Parameters for {@link useUndoRedoShortcuts}.
export interface UndoRedoShortcutsParams {
  // Whether an undo step is available; a Cmd/Ctrl+Z press no-ops when `false`.
  canUndo: boolean;
  // Whether a redo step is available; the redo chords no-op when `false`.
  canRedo: boolean;
  // Step the document history back one entry.
  onUndo: () => void;
  // Step the document history forward one entry.
  onRedo: () => void;
  // Gates the whole listener (default `true`). Set it `false` to silence the
  // shortcuts while some other surface owns the keyboard — e.g. an open drawer
  // or overlay whose own controls take over, so a stray Cmd/Ctrl+Z doesn't
  // reach through it to mutate the document behind it.
  enabled?: boolean;
}

// Global Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z / Ctrl+Y (redo) bound to a
// document-level history. Bails out when focus is inside an editable element
// (`<input>` / `<textarea>` / `<select>` / `contenteditable`) so the browser's
// native field-level undo keeps working while the user is typing — the global
// timeline only steps the document history (create / delete an item, a whole
// editing session) once focus leaves the text.
//
// The hook owns the keyboard wiring only; you own where the history lives and
// what an undo/redo does (pass `canUndo`/`canRedo` and the `onUndo`/`onRedo`
// steppers from your store).
export function useUndoRedoShortcuts(params: UndoRedoShortcutsParams): void {
  const { canUndo, canRedo, onUndo, onRedo, enabled = true } = params;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
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
      if (isUndo && canUndo) {
        e.preventDefault();
        onUndo();
      } else if (isRedo && canRedo) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, canUndo, canRedo, onUndo, onRedo]);
}
