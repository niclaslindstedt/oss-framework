// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from "react";

import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { classifyLines } from "./markdown.ts";
import { lineTextClass } from "./markdown-line-class.ts";
import { RenderedLine } from "./MarkdownLine.tsx";
import {
  extractSourceRange,
  sourcePointFromDom,
} from "./markdown-selection.ts";

// Zero-width space — invisible, but a real character the keyboard can delete.
const SENTINEL = "​";

// The default placeholder shown on an empty document; override via `labels`.
const DEFAULT_START_WRITING = "Start writing…";

// An Obsidian-style live-preview Markdown editor. The document is rendered as
// a column of lines; every line shows its formatted Markdown except the one
// the caret sits on, which becomes a plain textarea showing the raw source.
// Moving the caret (arrows, click) "rolls" that single editable textarea from
// line to line, so editing always happens against the literal source while
// the rest of the document stays formatted.
//
// Until the user actually places the caret — by clicking a line, the empty
// space below it, or being handed focus from outside — *no* line is active
// and the whole document renders as formatted Markdown (`active` is null). This
// is the opening state for an existing document: there is no raw textarea to
// leave the last line unformatted, and on mobile the soft keyboard stays down
// until a tap.
//
// The source string is the single source of truth — we never read formatted
// DOM back. Each edit mutates the line array and re-derives the string;
// structural keys (Enter / Backspace / Delete at a boundary) splice lines
// explicitly. Clicks on a rendered line map back to a caret column via the
// `data-src` source offsets the renderer stamps on every leaf.
//
// A drag across lines is a selection, not a caret move: the textarea (a
// selection island) is dissolved so every line is plain selectable text, the
// selection is driven with the Selection API, and a copy puts the verbatim
// *source* (Markdown, full URLs) on the clipboard via `markdown-selection.ts`.

/** User-facing strings the editor shows; all optional (English defaults). */
export type MarkdownEditorLabels = {
  /** Placeholder shown on an empty document. */
  startWriting?: string;
};

type Props = {
  body: string;
  onChange: (body: string) => void;
  /** Wrap long lines, or keep them on one line and scroll horizontally. */
  wordWrap?: boolean;
  /** Turn off browser/OS spell check (the red squiggles). */
  disableSpellcheck?: boolean;
  /** Turn off mobile autocorrect and auto-capitalisation. */
  disableAutocorrect?: boolean;
  /** Max width of the writing column (`"none"` for full-bleed). */
  maxWidth?: string;
  /** Place the caret in the body on mount (false to leave it fully formatted). */
  focusOnMount?: boolean;
  /** Trim bare URLs in the preview to this many characters either side (0 = off). */
  shortenLinkChars?: number;
  /** User-facing strings (placeholder); English defaults apply. */
  labels?: MarkdownEditorLabels;
  /** Imperative handle so an outside field can hand focus down into the body. */
  ref?: Ref<MarkdownEditorHandle>;
};

/** What the editor exposes to its parent: a way to start editing from outside. */
export type MarkdownEditorHandle = {
  /** Place the caret at the end of the document and open the textarea there. */
  focus: () => void;
};

export function MarkdownEditor({
  body,
  onChange,
  wordWrap = true,
  disableSpellcheck = false,
  disableAutocorrect = false,
  maxWidth = "none",
  focusOnMount = true,
  shortenLinkChars = 0,
  labels,
  ref,
}: Props) {
  const startWriting = labels?.startWriting ?? DEFAULT_START_WRITING;
  // True on phones / tablets — the devices that show a soft keyboard, and so
  // the only ones where `autoCapitalize` does anything. Gates the manual
  // sentence-start capitalization below so desktop (where the attribute is a
  // no-op) keeps behaving exactly as before.
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  // Local source of truth, seeded from the body. The host keys the editor by
  // document id, so a different document remounts rather than reconciling
  // mid-edit.
  const [value, setValue] = useState(body);
  const lines = useMemo(() => value.split("\n"), [value]);
  const blocks = useMemo(() => classifyLines(value), [value]);

  // The line currently being edited as raw text, or `null` when no line is
  // active and the whole document renders formatted. We only auto-open a line
  // when the parent asks the body to take focus on mount (`focusOnMount`);
  // otherwise the document stays fully formatted until the user clicks (or focus
  // is handed in), so nothing renders as a raw textarea on open.
  const [active, setActive] = useState<number | null>(() =>
    focusOnMount ? Math.max(0, value.split("\n").length - 1) : null,
  );

  // Adopt an out-of-band change to this body — a live update while the document
  // is open — without disturbing the user's own typing. Our own keystrokes echo
  // back through `onChange` to the identical string, so a `body` that differs
  // from the local value can only be another writer's edit. Clamp the active
  // line so the caret stays in range against the freshly arrived document.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (body === valueRef.current) return;
    setValue(body);
    setActive((a) =>
      a === null ? null : Math.min(a, body.split("\n").length - 1),
    );
  }, [body]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Caret column to install the next time the textarea (re)focuses — set
  // whenever we move the active line programmatically. Null on mount when the
  // body shouldn't grab focus; clicks / arrow keys still set it, so the body
  // stays fully editable.
  const pendingCaret = useRef<number | null>(
    focusOnMount ? value.length : null,
  );

  const clampedActive =
    active === null ? null : Math.min(active, lines.length - 1);
  // Whether a line is open as a raw textarea (edit mode), versus the document
  // rendering fully formatted with no caret placed yet.
  const isEditing = clampedActive !== null;

  // An empty active line below the first one carries an invisible zero-width
  // sentinel inside its textarea. A soft keyboard only fires the `beforeinput`
  // delete event when there is something *before* the caret to delete; an
  // empty textarea therefore swallows Backspace, so holding it would erase a
  // line down to its start and then stop instead of merging into the line
  // above. The sentinel gives that Backspace something to bite on, which we
  // intercept and turn into a merge. It never reaches the source string — the
  // textarea shows it but `value`/`onChange` only ever see the real line.
  const activeLine = clampedActive === null ? "" : (lines[clampedActive] ?? "");
  const useSentinel =
    clampedActive !== null && clampedActive > 0 && activeLine === "";
  const caretOffset = useSentinel ? SENTINEL.length : 0;

  // Apply a line-array mutation: re-derive the source, move the active line,
  // and queue the caret column for the effect below to install.
  function commit(nextLines: string[], nextActive: number, caretCol: number) {
    const next = nextLines.join("\n");
    setValue(next);
    onChange(next);
    setActive(nextActive);
    pendingCaret.current = caretCol;
  }

  function moveTo(nextActive: number, caretCol: number) {
    setActive(nextActive);
    pendingCaret.current = caretCol;
  }

  // The three structural edits, shared by the desktop key handler and the
  // mobile `beforeinput` handler below. Each splices the line array and moves
  // the caret; callers decide *when* to fire them from their own event.
  function splitLine(start: number, end: number) {
    if (clampedActive === null) return;
    const text = lines[clampedActive] ?? "";
    const i = clampedActive;
    const next = [...lines];
    next.splice(i, 1, text.slice(0, start), text.slice(end));
    commit(next, i + 1, 0);
  }

  function mergeWithPrev() {
    if (clampedActive === null) return;
    const text = lines[clampedActive] ?? "";
    const i = clampedActive;
    const prev = lines[i - 1]!;
    const next = [...lines];
    next.splice(i - 1, 2, prev + text);
    commit(next, i - 1, prev.length);
  }

  function mergeWithNext() {
    if (clampedActive === null) return;
    const text = lines[clampedActive] ?? "";
    const i = clampedActive;
    const next = [...lines];
    next.splice(i, 2, text + lines[i + 1]!);
    commit(next, i, text.length);
  }

  // Size the textarea to its content (so it never scrolls internally) and
  // install any pending caret. Runs after every value / active-line change.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
    if (wordWrap) {
      ta.style.width = "";
    } else {
      ta.style.width = "auto";
      ta.style.width = `${ta.scrollWidth}px`;
    }
    if (pendingCaret.current !== null) {
      const col =
        caretOffset + Math.min(pendingCaret.current, activeLine.length);
      ta.focus();
      ta.setSelectionRange(col, col);
      pendingCaret.current = null;
    } else if (
      useSentinel &&
      document.activeElement === ta &&
      ta.selectionStart < caretOffset
    ) {
      // Keep the caret *after* the sentinel so a Backspace deletes the sentinel
      // (which we turn into a merge) rather than landing before it and no-op-ing
      // — the case that previously left the caret stuck at the line start.
      ta.setSelectionRange(caretOffset, caretOffset);
    }
  }, [
    clampedActive,
    value,
    wordWrap,
    useSentinel,
    caretOffset,
    activeLine.length,
  ]);

  // Structural edits also arrive as `beforeinput` events, and on mobile this
  // is the *only* place they show up: soft keyboards (and IME composition)
  // deliver Enter / Backspace / Delete as `keyCode 229` "Unidentified"
  // keystrokes that never match the `onKeyDown` cases above, but they always
  // fire a `beforeinput` carrying a semantic `inputType`. We mirror the same
  // three edits here, keyed off `inputType` instead of `key`. On desktop the
  // key handler runs first and `preventDefault()`s, which suppresses the
  // matching `beforeinput`, so the two paths never both fire for one keystroke.
  //
  // Attached natively (not via React's synthetic `onBeforeInput`, whose
  // `inputType` coverage is unreliable) through a ref so the listener always
  // sees current state. The textarea keeps a stable identity (`key="active"`)
  // as the active line rolls, so we only re-bind when it actually mounts or
  // unmounts — i.e. when the document enters or leaves edit mode.
  const handleBeforeInput = useRef<(e: InputEvent) => void>(() => {});
  handleBeforeInput.current = (e: InputEvent) => {
    const ta = taRef.current;
    if (!ta || clampedActive === null) return;
    // Work in source-line columns: subtract the sentinel so column 0 of an
    // empty line is detected whether or not the textarea carries the sentinel.
    const start = ta.selectionStart - caretOffset;
    const end = ta.selectionEnd - caretOffset;
    const text = lines[clampedActive] ?? "";
    const i = clampedActive;
    switch (e.inputType) {
      case "insertLineBreak":
      case "insertParagraph":
        e.preventDefault();
        splitLine(start, end);
        break;
      case "deleteContentBackward":
        if (start === 0 && end === 0 && i > 0) {
          e.preventDefault();
          mergeWithPrev();
        }
        break;
      case "deleteContentForward":
        if (
          start === text.length &&
          end === text.length &&
          i < lines.length - 1
        ) {
          e.preventDefault();
          mergeWithNext();
        }
        break;
    }
  };

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const listener = (e: InputEvent) => handleBeforeInput.current(e);
    ta.addEventListener("beforeinput", listener);
    return () => ta.removeEventListener("beforeinput", listener);
    // Re-bind whenever the textarea mounts/unmounts (edit mode toggling on/off,
    // including a selection drag dissolving it — see below).
  }, [isEditing]);

  function onTextChange(ta: HTMLTextAreaElement) {
    if (clampedActive === null) return;
    const raw = ta.value;
    // The sentinel was deleted, leaving the field empty: that Backspace is the
    // one a soft keyboard would otherwise have swallowed. Merge into the line
    // above (this only fires below the first line, where the sentinel lives).
    if (useSentinel && raw === "") {
      mergeWithPrev();
      return;
    }
    // Strip the sentinel back out so the source string never sees it, and
    // shift the queued caret to match the removed character.
    const hadSentinel = raw.startsWith(SENTINEL);
    let text = hadSentinel ? raw.slice(SENTINEL.length) : raw;
    if (hadSentinel) {
      pendingCaret.current = Math.max(0, ta.selectionStart - SENTINEL.length);
      // The sentinel that seeds an empty continuation line sits in front of the
      // caret, so the soft keyboard reads the field as mid-sentence and skips
      // the capitalization `autoCapitalize="sentences"` would otherwise apply at
      // the start of a new paragraph (the first line, which carries no sentinel,
      // capitalizes natively). Restore it for the first character typed onto the
      // line — but only on touch devices, mirroring where the attribute applies,
      // and never when autocorrect is off (which also turns `autoCapitalize`
      // off). Guard against a case-fold that changes length (e.g. ß → SS) so the
      // queued caret stays put.
      if (coarsePointer && !disableAutocorrect && text.length > 0) {
        const first = text[0]!;
        const upper = first.toLocaleUpperCase();
        if (upper.length === first.length) text = upper + text.slice(1);
      }
    }
    const next = [...lines];
    next[clampedActive] = text;
    const joined = next.join("\n");
    setValue(joined);
    onChange(joined);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (clampedActive === null) return;
    const ta = e.currentTarget;
    // Source-line columns (see the `beforeinput` handler): the sentinel sits in
    // front of the caret on an empty line, so discount it before comparing.
    const start = ta.selectionStart - caretOffset;
    const end = ta.selectionEnd - caretOffset;
    const text = lines[clampedActive] ?? "";
    const i = clampedActive;

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      splitLine(start, end);
      return;
    }

    if (e.key === "Backspace" && start === 0 && end === 0 && i > 0) {
      e.preventDefault();
      mergeWithPrev();
      return;
    }

    if (
      e.key === "Delete" &&
      start === text.length &&
      end === text.length &&
      i < lines.length - 1
    ) {
      e.preventDefault();
      mergeWithNext();
      return;
    }

    if (e.key === "ArrowLeft" && start === 0 && end === 0 && i > 0) {
      e.preventDefault();
      moveTo(i - 1, lines[i - 1]!.length);
      return;
    }

    if (
      e.key === "ArrowRight" &&
      start === text.length &&
      end === text.length &&
      i < lines.length - 1
    ) {
      e.preventDefault();
      moveTo(i + 1, 0);
      return;
    }

    // Up / down cross to the adjacent line when the caret is already on the
    // textarea's first / last visual row (a single-row line always qualifies),
    // otherwise the textarea moves the caret within its own wrapped rows.
    if (e.key === "ArrowUp" && i > 0) {
      if (visualRows(ta) <= 1 || start === 0) {
        e.preventDefault();
        moveTo(i - 1, Math.min(start, lines[i - 1]!.length));
        return;
      }
    }
    if (e.key === "ArrowDown" && i < lines.length - 1) {
      if (visualRows(ta) <= 1 || end === text.length) {
        e.preventDefault();
        moveTo(i + 1, Math.min(start, lines[i + 1]!.length));
        return;
      }
    }
  }

  // Clicking a rendered line makes it active, placing the caret at the source
  // column nearest the pointer (resolved through the `data-src` offsets).
  function activateAt(e: ReactMouseEvent, index: number) {
    e.preventDefault();
    moveTo(index, columnFromPoint(e.clientX, e.clientY, blocks[index]!));
  }

  // A click anywhere in the empty space (the scroll container or the padding
  // around the lines) drops the caret on a blank line at the very bottom and
  // opens the editor. When the document doesn't already end in an empty line,
  // append one and put the caret there — otherwise the click would roll the
  // editing textarea onto the last *content* line, turning a rendered line back
  // into raw source just to give the caret somewhere to land.
  function activateEnd(e: ReactMouseEvent) {
    e.preventDefault();
    placeCaretAtEnd();
  }

  // Open edit mode at the end of the document (the bottom blank line), the
  // shared body of `activateEnd` and the imperative `focus()` handed in.
  function placeCaretAtEnd() {
    const last = lines.length - 1;
    if (lines[last] !== "") {
      // Append the blank line locally so the caret has somewhere to land, but
      // *don't* push it through `onChange` — placing the caret is not an edit,
      // and persisting this newline could bump an `updatedAt` and reorder the
      // document just for entering edit mode. The empty line becomes part of
      // the document only once the user actually types onto it.
      const next = [...lines, ""];
      setValue(next.join("\n"));
      setActive(next.length - 1);
      pendingCaret.current = 0;
      return;
    }
    // The document already ends in a blank line; just land the caret on it.
    // When that blank line is already the active line — the single empty-line
    // case — `setActive` would be a no-op, so the layout effect that installs
    // the caret never runs; focus the textarea directly here so editing always
    // starts, regardless of how tall the document is.
    if (last === clampedActive) {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(0, 0);
      }
      return;
    }
    moveTo(last, 0);
  }

  // Expose `focus()` to the parent so an outside field can hand the caret down
  // into the body. Routed through a ref so the handle always runs the latest
  // closure (over the current line array), matching the `beforeinput` listener.
  const placeCaretAtEndRef = useRef(placeCaretAtEnd);
  placeCaretAtEndRef.current = placeCaretAtEnd;
  useImperativeHandle(
    ref,
    () => ({ focus: () => placeCaretAtEndRef.current() }),
    [],
  );

  // --- Cross-line text selection -------------------------------------------
  //
  // The active line is a textarea, an isolated selection island, and every
  // other line is its own element — so a native drag can only ever select
  // within one line. To let the user sweep a selection across the whole
  // document (desktop), a drag is tracked from a capture-phase mousedown (so it
  // fires even on a link, which stops the bubble-phase handler) and, once it
  // crosses a small threshold, edit mode is dropped (`active = null`, all lines
  // render as formatted divs) and the selection is driven directly with the
  // Selection API from the press point to the pointer. A plain click (no drag)
  // still rolls the caret onto the clicked line via the existing handlers.
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(
    null,
  );

  function driveSelection(ax: number, ay: number, fx: number, fy: number) {
    const a = caretFromPoint(ax, ay);
    const b = caretFromPoint(fx, fy);
    if (!a || !b) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      sel.setBaseAndExtent(a.node, a.offset, b.node, b.offset);
    } catch {
      // The anchor node can be transiently invalid in the frame the textarea is
      // dissolved; the next mousemove re-runs against the settled DOM.
    }
  }

  const onSelMove = useRef<(e: MouseEvent) => void>(() => {});
  const onSelUp = useRef<(e: MouseEvent) => void>(() => {});
  onSelMove.current = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.dragging) {
      if (Math.abs(e.clientX - d.x) < 4 && Math.abs(e.clientY - d.y) < 4)
        return;
      d.dragging = true;
      // Drop edit mode so every line is plain selectable text (no textarea).
      setActive(null);
    }
    e.preventDefault();
    driveSelection(d.x, d.y, e.clientX, e.clientY);
  };
  onSelUp.current = () => {
    const d = dragRef.current;
    dragRef.current = null;
    document.removeEventListener("mousemove", selMoveListener);
    document.removeEventListener("mouseup", selUpListener);
    if (d?.dragging) {
      // Swallow the click the browser fires after the drag so a sweep that began
      // on a link doesn't also navigate to it once the button is released.
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener("click", swallow, {
        capture: true,
        once: true,
      });
    }
  };
  const selMoveListener = useRef((e: MouseEvent) =>
    onSelMove.current(e),
  ).current;
  const selUpListener = useRef((e: MouseEvent) => onSelUp.current(e)).current;

  // Begin tracking a potential selection drag. Runs in the capture phase so it
  // sees presses on links too (their bubble-phase handler stops propagation to
  // keep a click navigating). Caret placement stays on the bubble handlers, so
  // a press that turns out to be a plain click behaves exactly as before.
  function startDragTracking(e: ReactMouseEvent) {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: false };
    document.addEventListener("mousemove", selMoveListener);
    document.addEventListener("mouseup", selUpListener);
  }

  // Put the verbatim source of a live-preview selection on the clipboard rather
  // than the rendered text — so Markdown and full (un-shortened) URLs survive a
  // copy. A selection inside the active textarea isn't part of the document
  // selection, so it falls through to the browser's own (already-raw) copy.
  const onCopy = useRef<(e: ClipboardEvent) => void>(() => {});
  onCopy.current = (e: ClipboardEvent) => {
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const { anchorNode, focusNode } = sel;
    if (!anchorNode || !focusNode) return;
    if (!root.contains(anchorNode) || !root.contains(focusNode)) return;
    const start = sourcePointFromDom(
      root,
      blocks,
      anchorNode,
      sel.anchorOffset,
    );
    const end = sourcePointFromDom(root, blocks, focusNode, sel.focusOffset);
    if (!start || !end) return;
    e.preventDefault();
    e.clipboardData?.setData(
      "text/plain",
      extractSourceRange(lines, blocks, start, end),
    );
  };

  useEffect(() => {
    const copyListener = (e: ClipboardEvent) => onCopy.current(e);
    document.addEventListener("copy", copyListener);
    return () => {
      document.removeEventListener("copy", copyListener);
      // Drop any drag listeners left over from an unmount mid-gesture.
      document.removeEventListener("mousemove", selMoveListener);
      document.removeEventListener("mouseup", selUpListener);
    };
  }, [selMoveListener, selUpListener]);

  const widthStyle =
    maxWidth === "none" ? undefined : { maxWidth, margin: "0 auto" };
  const wrapClass = wordWrap
    ? "whitespace-pre-wrap break-words"
    : "whitespace-pre";

  return (
    // This is one editing widget, not a set of independent controls: the
    // textarea is the focusable, keyboard-driven surface, and the line
    // <div>s are non-interactive visual proxies for source the textarea
    // edits. Clicking one only repositions the caret (keyboard users move it
    // with the arrow keys).
    <div
      ref={rootRef}
      className={`min-h-0 flex-1 ${wordWrap ? "overflow-y-auto" : "overflow-auto"}`}
      // Capture phase so a press on a link (which stops the bubble handler to
      // stay clickable) still arms a cross-line selection drag.
      onMouseDownCapture={startDragTracking}
      onMouseDown={(e) => {
        // A click in the empty area below the text drops the caret at the end
        // of the document rather than doing nothing.
        if (e.target === e.currentTarget) activateEnd(e);
      }}
    >
      <div
        className={`px-4 py-4 ${wordWrap ? "" : "w-max min-w-full"}`}
        style={widthStyle}
        onMouseDown={(e) => {
          // Clicks landing on the content wrapper itself — its padding or the
          // gaps around the lines — count as the empty space too.
          if (e.target === e.currentTarget) activateEnd(e);
        }}
      >
        {lines.map((line, index) => {
          if (index === clampedActive) {
            return (
              <textarea
                key="active"
                ref={taRef}
                rows={1}
                wrap={wordWrap ? "soft" : "off"}
                value={useSentinel ? SENTINEL : line}
                spellCheck={!disableSpellcheck}
                autoCorrect={disableAutocorrect ? "off" : "on"}
                autoCapitalize={disableAutocorrect ? "off" : "sentences"}
                placeholder={lines.length === 1 ? startWriting : undefined}
                onChange={(e) => onTextChange(e.currentTarget)}
                onKeyDown={onKeyDown}
                className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-fg outline-none placeholder:text-muted/60 ${wrapClass} ${lineTextClass(
                  blocks[index]!,
                )}`}
              />
            );
          }
          return (
            // A visual proxy for one source line; clicking rolls the editing
            // textarea here. See the widget note above.
            <div
              key={index}
              data-line-index={index}
              onMouseDown={(e) => activateAt(e, index)}
              className={`cursor-text text-fg ${wrapClass}`}
            >
              {value === "" ? (
                // An entirely empty document has nothing to format, so show the
                // same affordance the active textarea would — clicking it opens
                // edit mode on this blank line.
                <span className="text-muted/60">{startWriting}</span>
              ) : (
                <RenderedLine
                  block={blocks[index]!}
                  shortenLinkChars={shortenLinkChars}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Whether a line wraps — used to decide whether an up/down arrow should cross
// to the next line or move within a wrapped line.
function visualRows(ta: HTMLTextAreaElement): number {
  const cs = getComputedStyle(ta);
  let lh = parseFloat(cs.lineHeight);
  if (!lh) lh = parseFloat(cs.fontSize) * 1.5;
  return lh > 0 ? Math.max(1, Math.round(ta.scrollHeight / lh)) : 1;
}

type CaretHit = { node: Node; offset: number };

function caretFromPoint(x: number, y: number): CaretHit | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    return range
      ? { node: range.startContainer, offset: range.startOffset }
      : null;
  }
  return null;
}

// Translate a pointer position over a rendered line into a source column,
// reading the `data-src` offset off the nearest stamped leaf. Falls back to
// the end of the line's content when the pointer doesn't land on text.
function columnFromPoint(
  x: number,
  y: number,
  block: { content: string; contentStart: number },
): number {
  const fallback = block.contentStart + block.content.length;
  const hit = caretFromPoint(x, y);
  if (!hit) return fallback;
  let el: Element | null =
    hit.node.nodeType === Node.TEXT_NODE
      ? hit.node.parentElement
      : (hit.node as Element);
  while (el && !(el instanceof HTMLElement && el.dataset.src !== undefined)) {
    el = el.parentElement;
  }
  if (el instanceof HTMLElement && el.dataset.src !== undefined) {
    const base = Number.parseInt(el.dataset.src, 10);
    const local = hit.node.nodeType === Node.TEXT_NODE ? hit.offset : 0;
    return base + local;
  }
  return fallback;
}
