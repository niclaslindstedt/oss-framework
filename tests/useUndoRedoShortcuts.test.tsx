// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUndoRedoShortcuts } from "../src/hooks/useUndoRedoShortcuts.ts";

type Mods = { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

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

type Params = Parameters<typeof useUndoRedoShortcuts>[0];

function setup(overrides: Partial<Params>) {
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  const view = renderHook((props: Params) => useUndoRedoShortcuts(props), {
    initialProps: {
      canUndo: true,
      canRedo: true,
      onUndo,
      onRedo,
      ...overrides,
    },
  });
  return { onUndo, onRedo, view };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useUndoRedoShortcuts", () => {
  it("undoes on Cmd/Ctrl+Z and redoes on Shift variant or Ctrl+Y", () => {
    const { onUndo, onRedo } = setup({});

    press("z", { ctrlKey: true });
    press("z", { metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);

    press("z", { ctrlKey: true, shiftKey: true });
    press("y", { ctrlKey: true });
    expect(onRedo).toHaveBeenCalledTimes(2);
  });

  it("calls preventDefault only when a chord acts", () => {
    setup({});

    const acted = press("z", { ctrlKey: true });
    expect(acted.defaultPrevented).toBe(true);

    const plain = press("z");
    expect(plain.defaultPrevented).toBe(false);
  });

  it("no-ops when the matching direction is unavailable", () => {
    const { onUndo, onRedo } = setup({ canUndo: false, canRedo: false });

    const undo = press("z", { ctrlKey: true });
    const redo = press("z", { ctrlKey: true, shiftKey: true });

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
    expect(undo.defaultPrevented).toBe(false);
    expect(redo.defaultPrevented).toBe(false);
  });

  it("bails out while focus is inside an editable element", () => {
    const { onUndo } = setup({});
    const input = document.createElement("input");
    document.body.appendChild(input);

    press("z", { ctrlKey: true }, input);

    expect(onUndo).not.toHaveBeenCalled();
  });

  it("ignores chords without a Ctrl/Cmd modifier", () => {
    const { onUndo, onRedo } = setup({});

    press("z");
    press("y");

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("stays silent while disabled, and rebinds when re-enabled", () => {
    const { onUndo, view } = setup({ enabled: false });

    press("z", { ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();

    view.rerender({
      canUndo: true,
      canRedo: true,
      onUndo,
      onRedo: vi.fn(),
      enabled: true,
    });
    press("z", { ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("silences chords while a modal is open, by default", () => {
    const { onUndo, onRedo } = setup({});
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    const undo = press("z", { ctrlKey: true });
    const redo = press("z", { ctrlKey: true, shiftKey: true });

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
    // It bows out without swallowing the key — the modal's own handlers run.
    expect(undo.defaultPrevented).toBe(false);
    expect(redo.defaultPrevented).toBe(false);
  });

  it("keeps chords live with an open modal when gateWhileModalOpen is false", () => {
    const { onUndo } = setup({ gateWhileModalOpen: false });
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    press("z", { ctrlKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("re-arms once the modal closes", () => {
    const { onUndo } = setup({});
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    press("z", { ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();

    modal.remove();
    press("z", { ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("detaches the listener on unmount", () => {
    const { onUndo, view } = setup({});

    view.unmount();
    press("z", { ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
  });
});
