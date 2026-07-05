// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Lightbox, type LightboxItem } from "../src/viewer/index.ts";

const items = (n: number): LightboxItem[] =>
  Array.from({ length: n }, (_, i) => ({
    render: () => <span data-testid={`item-${i}`}>item {i}</span>,
    label: `Item ${i + 1}`,
  }));

describe("Lightbox", () => {
  it("renders a labelled dialog with every item and a live counter", () => {
    render(<Lightbox items={items(3)} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Viewer" });
    expect(dialog).toBeTruthy();
    expect(screen.getByTestId("item-0")).toBeTruthy();
    expect(screen.getByTestId("item-2")).toBeTruthy();
    const counter = screen.getByText("1 of 3");
    expect(counter.getAttribute("aria-live")).toBe("polite");
  });

  it("shows no counter, dots, or edge buttons for a single item", () => {
    render(<Lightbox items={items(1)} onClose={() => {}} />);
    expect(screen.queryByText(/1 of/)).toBeNull();
    expect(screen.queryByLabelText("Next")).toBeNull();
    expect(screen.queryByLabelText("Go to item 1")).toBeNull();
  });

  it("pages with the arrow keys, clamped at the ends", () => {
    const onIndexChange = vi.fn();
    render(
      <Lightbox
        items={items(3)}
        onIndexChange={onIndexChange}
        onClose={() => {}}
      />,
    );
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("2 of 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("3 of 3")).toBeTruthy();
    // Clamped: a further ArrowRight stays on the last item.
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("3 of 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(onIndexChange.mock.calls.map((c) => c[0])).toEqual([1, 2, 1]);
  });

  it("opens on initialIndex, clamped into range", () => {
    const { unmount } = render(
      <Lightbox items={items(3)} initialIndex={2} onClose={() => {}} />,
    );
    expect(screen.getByText("3 of 3")).toBeTruthy();
    unmount();
    render(<Lightbox items={items(3)} initialIndex={99} onClose={() => {}} />);
    expect(screen.getByText("3 of 3")).toBeTruthy();
  });

  it("pages via the dots and the edge buttons", () => {
    render(<Lightbox items={items(3)} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Go to item 3"));
    expect(screen.getByText("3 of 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Previous"));
    expect(screen.getByText("2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Next"));
    expect(screen.getByText("3 of 3")).toBeTruthy();
    // The edge button disables at the end.
    expect((screen.getByLabelText("Next") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("marks the current dot with aria-current", () => {
    render(<Lightbox items={items(2)} onClose={() => {}} />);
    expect(
      screen.getByLabelText("Go to item 1").getAttribute("aria-current"),
    ).toBe("true");
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(
      screen.getByLabelText("Go to item 2").getAttribute("aria-current"),
    ).toBe("true");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Lightbox items={items(2)} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click and on the close button", () => {
    const onClose = vi.fn();
    render(<Lightbox items={items(2)} onClose={onClose} />);
    // Two close-labelled buttons: the full-surface backdrop and the ✕.
    const buttons = screen.getAllByLabelText("Close");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on a vertical swipe past the dismiss distance", () => {
    const onClose = vi.fn();
    render(<Lightbox items={items(2)} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(dialog, { pointerId: 1, clientX: 50, clientY: 200 });
    fireEvent.pointerUp(dialog, { pointerId: 1, clientX: 50, clientY: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back from a short vertical drag without closing", () => {
    const onClose = vi.fn();
    render(<Lightbox items={items(2)} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(dialog, { pointerId: 1, clientX: 50, clientY: 90 });
    fireEvent.pointerUp(dialog, { pointerId: 1, clientX: 50, clientY: 90 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("takes injected labels over the English defaults", () => {
    render(
      <Lightbox
        items={items(2)}
        onClose={() => {}}
        labels={{
          title: "Galleri",
          close: "Stäng",
          counter: (i, n) => `${i} av ${n}`,
        }}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Galleri" })).toBeTruthy();
    expect(screen.getByText("1 av 2")).toBeTruthy();
    expect(screen.getAllByLabelText("Stäng").length).toBeGreaterThan(0);
    // Unspecified labels keep their defaults.
    expect(screen.getByLabelText("Next")).toBeTruthy();
  });
});
