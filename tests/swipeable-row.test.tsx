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
        leading={{ kind: "commit", onCommit: vi.fn() }}
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

  it("commits a right swipe past the threshold", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(
      <SwipeableRow leading={{ kind: "commit", onCommit }}>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const fg = screen.getByText("Groceries").parentElement as HTMLElement;

    down(fg, 100);
    move(fg, 116); // arm the horizontal axis
    move(fg, 210); // dx +110, past the default +96 dismiss point
    up(fg, 210);

    // Deferred until the slide-off animation completes.
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not commit when no leading side is wired (snaps back)", () => {
    vi.useFakeTimers();
    render(
      <SwipeableRow actions={[{ label: "Rename", onSelect: vi.fn() }]}>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const fg = screen.getByText("Groceries").parentElement as HTMLElement;

    down(fg, 100);
    move(fg, 116);
    move(fg, 210); // far right swipe — no leading commit wired
    up(fg, 210);
    vi.advanceTimersByTime(200);

    // The foreground settles back to its closed position.
    expect(fg.style.transform).toBe("translateX(0px)");
  });

  it("captions the commit backdrop with the caller's label (no default)", () => {
    render(
      <SwipeableRow
        leading={{ kind: "commit", onCommit: vi.fn(), label: "Stash" }}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    expect(screen.getByText("Stash")).toBeTruthy();
  });

  it("paints reveal buttons and the commit backdrop with custom colours", () => {
    render(
      <SwipeableRow
        trailing={{
          kind: "reveal",
          buttons: [
            {
              label: "Pin",
              icon: <span>📌</span>,
              onSelect: vi.fn(),
              background: "bg-warning",
              color: "text-black",
            },
          ],
        }}
        leading={{
          kind: "commit",
          onCommit: vi.fn(),
          label: "Done",
          background: "bg-success",
          color: "text-white",
        }}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const pin = screen.getByRole("button", { name: "Pin", hidden: true });
    expect(pin.className).toContain("bg-warning");
    expect(pin.className).toContain("text-black");
    const backdrop = screen.getByText("Done").parentElement as HTMLElement;
    expect(backdrop.className).toContain("bg-success");
    expect(backdrop.className).toContain("text-white");
  });

  it("commits a left swipe when the trailing side is a commit action", () => {
    vi.useFakeTimers();
    const onDelete = vi.fn();
    render(
      <SwipeableRow
        trailing={{ kind: "commit", onCommit: onDelete, label: "Delete" }}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    const fg = screen.getByText("Groceries").parentElement as HTMLElement;

    down(fg, 200);
    move(fg, 184); // arm horizontal (leftward)
    move(fg, 90); // dx -110, past the default -96 commit point
    up(fg, 90);

    expect(onDelete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("reveals a button strip on a right swipe when the leading side is a reveal", () => {
    const onSelect = vi.fn();
    render(
      <SwipeableRow
        leading={{
          kind: "reveal",
          buttons: [{ label: "Flag", icon: <span>🚩</span>, onSelect }],
        }}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    // The leading strip is present (aria-hidden until swiped), and tapping its
    // button fires the action — a right-swipe reveal, the mirror of the left.
    fireEvent.click(screen.getByRole("button", { name: "Flag", hidden: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders plainly with no swipe DOM when neither side is wired", () => {
    const { container } = render(
      <SwipeableRow>
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    expect(container.querySelector("[data-drawer-swipe-ignore]")).toBeNull();
    expect(screen.getByText("Groceries")).toBeTruthy();
  });

  it("gates the gesture off on a desktop pointer (renders plainly)", () => {
    // Model a desktop pointer: `useDesktopPointer` reads `(hover: hover) and
    // (pointer: fine)`, which jsdom doesn't ship — stub it to match. Swipe is a
    // touch affordance, so on desktop the row carries no swipe DOM and a drag
    // never latches it open (the actions are reached via a right-click menu).
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("hover: hover"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const onSelect = vi.fn();
    const { container } = render(
      <SwipeableRow
        actions={[{ label: "Rename", onSelect }]}
        leading={{ kind: "commit", onCommit: vi.fn() }}
      >
        <button type="button">Groceries</button>
      </SwipeableRow>,
    );
    // No swipe scaffolding: the drawer-ignore tag and the revealed strip are
    // both absent.
    expect(container.querySelector("[data-drawer-swipe-ignore]")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rename", hidden: true }),
    ).toBeNull();
    expect(screen.getByText("Groceries")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
