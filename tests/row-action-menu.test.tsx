// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowActionMenu } from "../src/components/index.ts";

afterEach(() => {
  vi.useRealTimers();
  document.body.style.overflow = "";
});

describe("RowActionMenu", () => {
  it("opens on right-click and fires the chosen action", () => {
    const onSelect = vi.fn();
    render(
      <RowActionMenu
        ariaLabel="Folder actions"
        actions={[{ label: "Rename", onSelect }]}
      >
        <button type="button">Work</button>
      </RowActionMenu>,
    );

    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(screen.getByText("Work"));

    const menu = screen.getByRole("menu", { name: "Folder actions" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    // Picking an action dismisses the menu.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on a touch long press", () => {
    vi.useFakeTimers();
    render(
      <RowActionMenu actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );
    const row = screen.getByText("Work");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("a drag past tolerance cancels the long press", () => {
    vi.useFakeTimers();
    render(
      <RowActionMenu actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );
    const row = screen.getByText("Work");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(row, { clientX: 80, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("stays inert with no actions", () => {
    render(
      <RowActionMenu actions={[]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Work"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
