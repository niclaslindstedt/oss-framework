// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowActionMenu } from "../src/components/index.ts";

// The menu splits its two entry points by pointer: right-click on desktop, long
// press on touch. `useDesktopPointer` reads `(hover: hover) and (pointer: fine)`
// via `matchMedia`, which jsdom doesn't ship — so stub it to model each device.
function setPointer(kind: "desktop" | "touch") {
  const isDesktop = kind === "desktop";
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("hover: hover") ? isDesktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("RowActionMenu", () => {
  it("opens on right-click and fires the chosen action (desktop)", () => {
    setPointer("desktop");
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

  it("suppresses the native menu but does not open on touch right-click", () => {
    setPointer("touch");
    render(
      <RowActionMenu actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );

    // A touch device's synthesised contextmenu is swallowed (preventDefault),
    // and the long press — not this — owns opening the menu, so nothing opens.
    const prevented = !fireEvent.contextMenu(screen.getByText("Work"));
    expect(prevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on a touch long press", () => {
    setPointer("touch");
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

  it("does not open on a desktop long (mouse) press", () => {
    setPointer("desktop");
    vi.useFakeTimers();
    render(
      <RowActionMenu actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );
    const row = screen.getByText("Work");

    fireEvent.pointerDown(row, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    // A held mouse button is not a long press — desktop opens via right-click.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("a drag past tolerance cancels the long press", () => {
    setPointer("touch");
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
    setPointer("desktop");
    render(
      <RowActionMenu actions={[]}>
        <button type="button">Work</button>
      </RowActionMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Work"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
