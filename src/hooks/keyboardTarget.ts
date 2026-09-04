// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Who the keyboard belongs to right now — the companion probe to
// `isModalOpen`, and the other half of the same question.
//
// An app with a canvas, a grid or a document surface has to listen for its
// shortcuts on the **window**: the thing being worked on takes no focus of its
// own, so there is nowhere else for the listener to go. That is the only way
// those keys can work at all, and it is also how they eat every keystroke
// meant for something else — a tool letter typed into a rename field swaps the
// tool, Cmd+C in a caption box copies the selection instead of the words,
// Escape in a search field closes the screen behind it.
//
// So there is one rule, stated once: **a field, or a dialog that is open, owns
// the keyboard.** Every window-level handler asks it first. Keeping it here
// rather than repeating the tag list per handler is worth doing for the same
// reason `isModalOpen` is: the list is longer than it looks (a `contenteditable`
// surface is a field; a `<select>` uses the arrow keys; a dialog's own controls
// are fields wherever they happen to be in the tree), and a handler that
// forgets one of them fails in a way nobody reports — the key simply does two
// things at once.
//
// Both are pure predicates over a node, so they can be called at event time
// with `e.target`, or against `document.activeElement`, or driven straight
// from a test with a detached element.

/** The tags whose whole purpose is to take keystrokes. */
const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Whether `node` is somewhere text is being entered: a form field, or any
 *  editable surface (`contenteditable`, in either of its modes).
 *
 *  This is the one to reach for when the question is "is the user typing?" —
 *  a shell that pins its own scroll back after the software keyboard closes, a
 *  blur before a dialog unmounts, an autosave that should not fire mid-word. */
export function isEditableTarget(node: EventTarget | null): boolean {
  const el = node as Element | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (FIELD_TAGS.has(el.tagName)) return true;
  // `isContentEditable` is the right answer where it exists — it accounts for
  // inheritance, so a `<span>` inside an editable box reports as editable too.
  // It is not universally implemented (jsdom leaves it `undefined`), so the
  // attribute is the fallback, walked up the tree for the same inheritance.
  const el2 = el as HTMLElement;
  if (typeof el2.isContentEditable === "boolean") return el2.isContentEditable;
  const owner = el.closest?.("[contenteditable]");
  if (!owner) return false;
  return owner.getAttribute("contenteditable") !== "false";
}

/** Whether something other than the page itself is taking keystrokes: an
 *  editable target, or anything inside an open dialog.
 *
 *  This is the one a window-level shortcut asks. The dialog half matters even
 *  where the press did not land in a field — a button inside a dialog is not
 *  editable, but a bare `Delete` reaching past it to the document underneath
 *  is still the wrong thing to happen. */
export function keyboardIsClaimed(node: EventTarget | null): boolean {
  if (isEditableTarget(node)) return true;
  const el = node as Element | null;
  return Boolean(el?.closest?.('[role="dialog"], [aria-modal="true"]'));
}

/** Let go of the keyboard, if a field currently has it.
 *
 *  Called before tearing down whatever the focused field is inside. On iOS the
 *  engine scrolls the page to reveal a focused field even on a page that
 *  cannot otherwise scroll, and undoes it when the field blurs — so a dialog
 *  that unmounts a focused field in the same tick as it closes leaves the
 *  whole app riding up under the status bar, with nothing left to scroll back
 *  to. Blurring first means the ordinary path never strands an offset;
 *  `useShellScrollPin` is the backstop for the paths that still do. */
export function blurActiveField(): void {
  if (typeof document === "undefined") return;
  const el = document.activeElement;
  if (isEditableTarget(el) && el instanceof HTMLElement) el.blur();
}
