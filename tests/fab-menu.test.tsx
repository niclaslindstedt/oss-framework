// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FabMenu } from "../src/components/index.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(overrides: Partial<Parameters<typeof FabMenu>[0]> = {}) {
  const onActivate = vi.fn();
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  render(
    <FabMenu
      aria-label="Add item"
      onActivate={onActivate}
      actions={[
        {
          icon: <span>A</span>,
          label: "Archive finished",
          onSelect: onArchive,
        },
        { icon: <span>D</span>, label: "Delete finished", onSelect: onDelete },
      ]}
      {...overrides}
    >
      <span>+</span>
    </FabMenu>,
  );
  return { onActivate, onArchive, onDelete };
}

describe("FabMenu", () => {
  it("fires onActivate on a plain tap", () => {
    const { onActivate, onArchive } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("fans out the actions on a long press, then a tap fires one without activating", () => {
    vi.useFakeTimers();
    const { onActivate, onArchive } = setup({ longPressMs: 400 });
    const fab = screen.getByRole("button", { name: "Add item" });
    fireEvent.pointerDown(fab, { pointerId: 1, button: 0 });
    // Hold past the threshold — the menu fans out (timer-driven setState).
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const archive = screen.getByRole("button", { name: "Archive finished" });
    fireEvent.click(archive);
    expect(onArchive).toHaveBeenCalledTimes(1);
    // The long press replaced the tap — the primary action never fired.
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("disables an action button when its action is disabled", () => {
    vi.useFakeTimers();
    setup({
      actions: [
        {
          icon: <span>A</span>,
          label: "Archive finished",
          onSelect: vi.fn(),
          disabled: true,
        },
      ],
    });
    const fab = screen.getByRole("button", { name: "Add item" });
    fireEvent.pointerDown(fab, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Archive finished",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
