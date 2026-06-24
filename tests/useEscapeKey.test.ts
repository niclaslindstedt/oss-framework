// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEscapeKey } from "../src/hooks/useEscapeKey.ts";

function pressEscape() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}

describe("useEscapeKey", () => {
  it("calls onEscape when enabled and Escape is pressed", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(false, onEscape));

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("detaches the listener on unmount", () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(true, onEscape));

    unmount();
    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});
