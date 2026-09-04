// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it } from "vitest";

import {
  blurActiveField,
  isEditableTarget,
  keyboardIsClaimed,
} from "../src/hooks/keyboardTarget.ts";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isEditableTarget", () => {
  it("says yes to the three field tags", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
  });

  it("says yes to a contenteditable surface", () => {
    const host = mount('<div contenteditable="true">note</div>');
    expect(isEditableTarget(host.firstElementChild)).toBe(true);
  });

  it("says no to ordinary elements, and to nothing at all", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("says no to a non-element event target", () => {
    expect(isEditableTarget(new EventTarget())).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});

describe("keyboardIsClaimed", () => {
  it("is claimed by a field", () => {
    expect(keyboardIsClaimed(document.createElement("input"))).toBe(true);
  });

  it("is claimed by anything inside an open dialog, field or not", () => {
    const host = mount(
      '<div role="dialog"><button id="ok">OK</button></div>' +
        '<button id="loose">Loose</button>',
    );
    expect(keyboardIsClaimed(host.querySelector("#ok"))).toBe(true);
    expect(keyboardIsClaimed(host.querySelector("#loose"))).toBe(false);
  });

  it("honours aria-modal as well as role=dialog", () => {
    const host = mount(
      '<div aria-modal="true"><span id="inside">x</span></div>',
    );
    expect(keyboardIsClaimed(host.querySelector("#inside"))).toBe(true);
  });

  it("leaves the bare page to the page", () => {
    const host = mount("<canvas></canvas>");
    expect(keyboardIsClaimed(host.firstElementChild)).toBe(false);
    expect(keyboardIsClaimed(null)).toBe(false);
  });
});

describe("blurActiveField", () => {
  it("blurs a focused field", () => {
    const host = mount('<input id="name" />');
    const input = host.querySelector<HTMLInputElement>("#name")!;
    input.focus();
    expect(document.activeElement).toBe(input);
    blurActiveField();
    expect(document.activeElement).not.toBe(input);
  });

  it("leaves a focused button alone", () => {
    const host = mount("<button>Go</button>");
    const button = host.querySelector("button")!;
    button.focus();
    blurActiveField();
    expect(document.activeElement).toBe(button);
  });
});
