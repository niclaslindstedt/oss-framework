// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SwipeableRow } from "../src/components/index.ts";

// jsdom doesn't implement pointer capture; the underlying `useRowSwipe` calls
// it once a drag locks onto the horizontal axis. Stub the trio so the gesture
// runs (mirrors the useRowSwipe test).
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(() => {
  vi.useRealTimers();
});

function down(el: Element, x: number) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: x, clientY: 40 });
}
function move(el: Element, x: number) {
  fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: 40 });
}
function up(el: Element, x: number) {
  fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: 40 });
}

describe("SwipeableRow", () => {
  it("reveals its actions as icon buttons and fires the chosen one", () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <SwipeableRow
        actions={[
          { label: "Rename", icon: <span>✎</span>, onSelect: onRename },
          {
            label: "Delete",
            icon: <span>🗑</span>,
            danger: true,
            onSelect: onDelete,
          },
        ]}
        onArchive={vi.fn()}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );

    // The strip buttons carry their label as the accessible name. The strip is
    // `aria-hidden` while the row sits closed (it's only bared by a swipe), so
    // reach it with `hidden: true`.
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", hidden: true }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("tags the row so an enclosing drawer's swipe-to-close stands down", () => {
    const { container } = render(
      <SwipeableRow actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    expect(container.querySelector("[data-drawer-swipe-ignore]")).toBeTruthy();
  });

  it("archives on a right swipe past the threshold", () => {
    vi.useFakeTimers();
    const onArchive = vi.fn();
    render(
      <SwipeableRow actions={[]} onArchive={onArchive}>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const fg = screen.getByText("Groceries").parentElement as HTMLElement;

    down(fg, 100);
    move(fg, 116); // arm the horizontal axis
    move(fg, 210); // dx +110, past the default +96 dismiss point
    up(fg, 210);

    // Deferred until the slide-off animation completes.
    expect(onArchive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("does not archive when no onArchive is given (snaps back)", () => {
    vi.useFakeTimers();
    render(
      <SwipeableRow actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const fg = screen.getByText("Groceries").parentElement as HTMLElement;

    down(fg, 100);
    move(fg, 116);
    move(fg, 210); // far right swipe — no archive wired
    up(fg, 210);
    vi.advanceTimersByTime(200);

    // The foreground settles back to its closed position.
    expect(fg.style.transform).toBe("translateX(0px)");
    // With no archive there is no archive backdrop in the row at all.
    expect(screen.queryByText("Archive")).toBeNull();
  });

  it("renders the archive backdrop with a custom label", () => {
    render(
      <SwipeableRow actions={[]} onArchive={vi.fn()} archiveLabel="Stash">
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    expect(screen.getByText("Stash")).toBeTruthy();
  });
});
