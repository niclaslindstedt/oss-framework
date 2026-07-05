// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSearchShortcuts } from "../src/hooks/useSearchShortcuts.ts";

type Mods = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

function press(key: string, mods: Mods = {}, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...mods,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

type Params = Parameters<typeof useSearchShortcuts>[0];

function setup(overrides: Partial<Params> = {}) {
  const onOpen = vi.fn();
  const view = renderHook((props: Params) => useSearchShortcuts(props), {
    initialProps: { onOpen, ...overrides },
  });
  return { onOpen, view };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSearchShortcuts", () => {
  it("opens with the typed character as the seed", () => {
    const { onOpen } = setup();

    const event = press("m");

    expect(onOpen).toHaveBeenCalledWith("m");
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens with an empty seed on Cmd/Ctrl+K", () => {
    const { onOpen } = setup();

    const ctrl = press("k", { ctrlKey: true });
    const meta = press("k", { metaKey: true });

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenNthCalledWith(1, "");
    expect(onOpen).toHaveBeenNthCalledWith(2, "");
    expect(ctrl.defaultPrevented).toBe(true);
    expect(meta.defaultPrevented).toBe(true);
  });

  it("fires the chord even while focus is inside an editable element", () => {
    const { onOpen } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);

    press("k", { ctrlKey: true }, input);

    expect(onOpen).toHaveBeenCalledWith("");
  });

  it("does not type-to-open from an editable element", () => {
    const { onOpen } = setup();
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    document.body.append(input, textarea);

    const inInput = press("m", {}, input);
    press("m", {}, textarea);

    expect(onOpen).not.toHaveBeenCalled();
    expect(inInput.defaultPrevented).toBe(false);
  });

  it("lets modified keys pass through, except the AltGr combination", () => {
    const { onOpen } = setup();

    press("c", { ctrlKey: true });
    press("v", { metaKey: true });
    press("x", { altKey: true });
    expect(onOpen).not.toHaveBeenCalled();

    // AltGr (Ctrl+Alt on Windows layouts) types a character, so it opens.
    press("@", { ctrlKey: true, altKey: true });
    expect(onOpen).toHaveBeenCalledWith("@");
  });

  it("ignores named keys and space", () => {
    const { onOpen } = setup();

    press("Enter");
    press("ArrowDown");
    press("Escape");
    const space = press(" ");

    expect(onOpen).not.toHaveBeenCalled();
    expect(space.defaultPrevented).toBe(false);
  });

  it("keeps only the chord when typeToOpen is false", () => {
    const { onOpen } = setup({ typeToOpen: false });

    press("m");
    expect(onOpen).not.toHaveBeenCalled();

    press("k", { ctrlKey: true });
    expect(onOpen).toHaveBeenCalledWith("");
  });

  it("silences both gestures while a modal is open, and re-arms after", () => {
    const { onOpen } = setup();
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    press("m");
    press("k", { ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();

    modal.remove();
    press("m");
    expect(onOpen).toHaveBeenCalledWith("m");
  });

  it("keeps gestures live with an open modal when gateWhileModalOpen is false", () => {
    const { onOpen } = setup({ gateWhileModalOpen: false });
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    press("m");

    expect(onOpen).toHaveBeenCalledWith("m");
  });

  it("stays silent while disabled", () => {
    const { onOpen } = setup({ enabled: false });

    press("m");
    press("k", { ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("skips events something else already handled", () => {
    const { onOpen } = setup();
    const event = new KeyboardEvent("keydown", {
      key: "m",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("uses the latest onOpen without re-binding", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook((props: Params) => useSearchShortcuts(props), {
      initialProps: { onOpen: first },
    });

    view.rerender({ onOpen: second });
    press("m");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("m");
  });

  it("detaches the listener on unmount", () => {
    const { onOpen, view } = setup();

    view.unmount();
    press("m");

    expect(onOpen).not.toHaveBeenCalled();
  });
});
