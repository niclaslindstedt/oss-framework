// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// A **plain-text editable box** — one element that is read and written in
// place, rather than a `<textarea>` swapped in over a rendered view.
//
// Reach for this when the writing surface has to be the same *shape* as the
// reading surface. A textarea is a rectangle: its lines cannot wrap around a
// float, so text typed into one beside a floated heading is laid out in
// whatever column a rectangle can have, and then jumps when the pen goes down
// and the real view reflows it. It also cannot shrink its type to fit, which
// is the other half of the same problem (`fit/`). An editable element is
// ordinary flowing content, so both surfaces are one shape.
//
// What that costs is this file: an editable element is read through the DOM
// rather than through `value`, and anything that puts the caret back has to
// say where in the *text* it means.
//
// Everything here is deliberately small and defensive, because what an engine
// builds inside an editable box is its own business: in the `plaintext-only`
// mode below, Chromium keeps the content as plain text with real newlines,
// while an engine falling back to ordinary editing may reach for `<br>` and
// wrapper elements. `innerText` is the one reader that understands both, so it
// is what the value is read with.
//
// Framework-free DOM utilities: no React, no component. Pair them with
// `contentEditable` on your own element.

/** Whether the engine understands `contenteditable="plaintext-only"` — the
 *  mode that keeps the box plain: no pasted formatting, no rich-text editing
 *  commands, a line break that is a line break.
 *
 *  Detected rather than assumed, because the fallback matters twice over: the
 *  attribute's invalid-value default is *inherit*, so an engine that does not
 *  know the keyword would leave the box uneditable, and the IDL setter throws
 *  on a value it does not know. Where it is missing, ask for ordinary editing
 *  instead and take the paste apart yourself with {@link insertPlainText}. */
export const PLAIN_TEXT_EDITING = detectPlainTextEditing();

function detectPlainTextEditing(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("div");
  try {
    probe.setAttribute("contenteditable", "plaintext-only");
  } catch {
    return false;
  }
  return probe.contentEditable === "plaintext-only";
}

/** What the editable box currently holds.
 *
 *  `innerText` rather than `textContent`: it is the *rendered* text, so a line
 *  break is one whether the engine wrote it as a newline or as a `<br>`. Set
 *  the box `white-space: pre-wrap` so nothing typed is collapsed on the way
 *  out. */
export function readPlainText(el: HTMLElement): string {
  // A box the user has emptied is empty, whatever the engine left in it:
  // deleting the last character leaves a filler `<br>` behind in Chromium, and
  // `innerText` reads that back as a newline — so a box cleared to nothing
  // would be saved as a blank line rather than as nothing at all. No text node
  // means no text; something that really does end in a line break has one.
  if (el.textContent === "") return "";
  return el.innerText;
}

/** Put `text` in the box as the one plain text node it should be — what
 *  opening the editor seeds it with, and what a refused keystroke rolls it
 *  back to.
 *
 *  Whatever structure the engine had built is replaced, which is also what
 *  lets {@link seatCaretAt} stay as simple as it is. A no-op when the box
 *  already holds exactly that, so seeding does not disturb a live caret. */
export function writePlainText(el: HTMLElement, text: string): void {
  if (readPlainText(el) === text && el.childNodes.length <= 1) return;
  el.textContent = text;
}

/** Where the caret is, counted in characters from the start of the box.
 *
 *  A range from the box's start to the caret, measured by the text it covers.
 *  `Range.toString()` sees text, not markup, so on an engine that writes its
 *  line breaks as `<br>` this counts a break as nothing — the caret can land a
 *  line break early after a rollback there, which is the whole of what that
 *  costs. */
export function plainTextCaret(el: HTMLElement): number {
  const doc = el.ownerDocument;
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return readPlainText(el).length;
  const at = selection.getRangeAt(0);
  if (!el.contains(at.endContainer)) return readPlainText(el).length;
  const upTo = doc.createRange();
  upTo.selectNodeContents(el);
  upTo.setEnd(at.endContainer, at.endOffset);
  return upTo.toString().length;
}

/** Put the caret `offset` characters into the box, having just written it with
 *  {@link writePlainText} — so the box holds a single text node and the offset
 *  is an offset into it.
 *
 *  Anything else (an empty box, an offset past the end) puts the caret at the
 *  end, which is where someone who has just been handed the pen expects it. */
export function seatCaretAt(el: HTMLElement, offset: number): void {
  const doc = el.ownerDocument;
  const selection = doc.getSelection();
  if (!selection) return;
  const range = doc.createRange();
  const node = el.firstChild;
  const length = node?.nodeValue?.length ?? 0;
  if (node && node.nodeType === Node.TEXT_NODE && offset <= length) {
    range.setStart(node, Math.max(0, offset));
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Insert `text` at the caret as plain text — what a paste is cut down to on
 *  an engine without `plaintext-only`.
 *
 *  `execCommand` is deprecated and is still the only insertion that leaves the
 *  engine's own undo stack intact, which is why it is tried first. */
export function insertPlainText(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  if (doc.execCommand?.("insertText", false, text)) return;
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = doc.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The parts of a keyboard event the rule below looks at — an actual
 *  `KeyboardEvent` satisfies it. */
export interface EditorKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** What a key means to an open plain-text editor.
 *
 *  `"newline"` is the browser's own default — the caller lets the keystroke
 *  through — and `null` is every other key, which is likewise not the
 *  caller's. Only `"close"` asks for anything.
 *
 *  The rule is that prose is prose: Enter writes a line break, the way it does
 *  everywhere else text is typed, and the editor is left the way a pen is put
 *  down — by looking somewhere else, by Escape, or by the Enter that carries a
 *  modifier, which is the keyboard's "I'm done" wherever a plain Enter is
 *  already spoken for. Nothing is lost by not "saving": a caller that commits
 *  each keystroke as it is typed has already stored it. */
export function editorKeyAction(e: EditorKey): "newline" | "close" | null {
  if (e.key === "Escape") return "close";
  if (e.key !== "Enter") return null;
  return e.ctrlKey || e.metaKey ? "close" : "newline";
}
