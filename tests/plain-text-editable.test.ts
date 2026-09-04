// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  editorKeyAction,
  insertPlainText,
  plainTextCaret,
  readPlainText,
  seatCaretAt,
  writePlainText,
} from "../src/components/plainTextEditable.ts";

function box(html = ""): HTMLElement {
  const el = document.createElement("div");
  el.contentEditable = "true";
  el.innerHTML = html;
  document.body.appendChild(el);
  // jsdom implements no rendering, so `innerText` is undefined on it. Text is
  // what the box holds, which for these purposes `textContent` reports.
  Object.defineProperty(el, "innerText", {
    configurable: true,
    get() {
      return (this as HTMLElement).textContent;
    },
  });
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  document.getSelection()?.removeAllRanges();
});

describe("readPlainText", () => {
  it("reads what the box holds", () => {
    expect(readPlainText(box("Supper"))).toBe("Supper");
  });

  it("reads a box the user has emptied as empty, not as a blank line", () => {
    // Deleting the last character leaves a filler <br> behind in Chromium.
    expect(readPlainText(box("<br>"))).toBe("");
  });
});

describe("writePlainText", () => {
  it("puts the text in as the single text node it should be", () => {
    const el = box("<b>old</b><i>stuff</i>");
    writePlainText(el, "Supper");
    expect(el.childNodes).toHaveLength(1);
    expect(el.firstChild!.nodeType).toBe(Node.TEXT_NODE);
    expect(readPlainText(el)).toBe("Supper");
  });

  it("leaves a box that already says exactly that alone", () => {
    const el = box("Supper");
    const node = el.firstChild;
    writePlainText(el, "Supper");
    expect(el.firstChild).toBe(node);
  });

  it("rewrites a box whose text matches but whose structure does not", () => {
    const el = box("<span>Sup</span><span>per</span>");
    writePlainText(el, "Supper");
    expect(el.childNodes).toHaveLength(1);
  });
});

describe("plainTextCaret / seatCaretAt", () => {
  it("round-trips an offset into the text", () => {
    const el = box("Supper with Ann");
    seatCaretAt(el, 6);
    expect(plainTextCaret(el)).toBe(6);
  });

  it("puts the caret at the end for an offset past it", () => {
    const el = box("Supper");
    seatCaretAt(el, 99);
    expect(plainTextCaret(el)).toBe(6);
  });

  it("puts the caret at the end of an empty box", () => {
    const el = box();
    seatCaretAt(el, 3);
    expect(plainTextCaret(el)).toBe(0);
  });

  it("reports the end when the selection is somewhere else entirely", () => {
    const el = box("Supper");
    const other = box("Elsewhere");
    seatCaretAt(other, 2);
    expect(plainTextCaret(el)).toBe(6);
  });

  it("reports the end when there is no selection at all", () => {
    const el = box("Supper");
    expect(plainTextCaret(el)).toBe(6);
  });
});

describe("insertPlainText", () => {
  it("takes the engine's own insertion when it has one", () => {
    const el = box("Supper");
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    insertPlainText(el, " tonight");
    expect(execCommand).toHaveBeenCalledWith("insertText", false, " tonight");
  });

  it("falls back to writing a text node at the caret", () => {
    const el = box("Supper");
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => false,
    });
    seatCaretAt(el, 6);
    insertPlainText(el, " tonight");
    expect(readPlainText(el)).toBe("Supper tonight");
    expect(plainTextCaret(el)).toBe(14);
  });
});

describe("editorKeyAction", () => {
  it("lets a plain Enter write a line break", () => {
    expect(editorKeyAction({ key: "Enter" })).toBe("newline");
  });

  it("closes on Escape, and on the Enter that carries a modifier", () => {
    expect(editorKeyAction({ key: "Escape" })).toBe("close");
    expect(editorKeyAction({ key: "Enter", metaKey: true })).toBe("close");
    expect(editorKeyAction({ key: "Enter", ctrlKey: true })).toBe("close");
  });

  it("has nothing to say about any other key", () => {
    expect(editorKeyAction({ key: "a" })).toBeNull();
    expect(editorKeyAction({ key: "Tab" })).toBeNull();
    expect(editorKeyAction({ key: "s", metaKey: true })).toBeNull();
  });
});
