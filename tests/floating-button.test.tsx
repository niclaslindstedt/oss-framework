// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FloatingButton,
  type MenuButtonPosition,
} from "../src/sidebar/index.ts";

function renderButton(
  overrides: Partial<React.ComponentProps<typeof FloatingButton>> = {},
) {
  const onPress = vi.fn();
  const onPositionChange = vi.fn();
  const onDraggingChange = vi.fn();
  const position: MenuButtonPosition = { side: "right", y: 0.5 };
  const utils = render(
    <FloatingButton
      position={position}
      onPositionChange={onPositionChange}
      onPress={onPress}
      onDraggingChange={onDraggingChange}
      label="Open settings"
      {...overrides}
    >
      <span data-testid="icon">cog</span>
    </FloatingButton>,
  );
  return { onPress, onPositionChange, onDraggingChange, ...utils };
}

describe("FloatingButton", () => {
  it("renders a fixed, labelled button wrapping its icon", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Open settings" });
    expect(button.className).toContain("fixed");
    expect(button.className).toContain("rounded-full");
    expect(screen.getByTestId("icon")).toBeTruthy();
  });

  it("fires onPress for a plain tap", () => {
    const { onPress } = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("forwards the overlay aria attributes", () => {
    renderButton({ haspopup: "dialog", expanded: true, controls: "panel-1" });
    const button = screen.getByRole("button", { name: "Open settings" });
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe("panel-1");
  });

  it("reports drag start/end and persists the dropped position", () => {
    const { onPress, onPositionChange, onDraggingChange } = renderButton();
    const button = screen.getByRole("button", { name: "Open settings" });

    // A press that travels past the drag threshold is a drag, not a tap.
    fireEvent.pointerDown(button, {
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
      clientX: 980,
      clientY: 400,
    });
    fireEvent.pointerMove(button, {
      pointerId: 1,
      clientX: 200,
      clientY: 410,
    });
    // Mid-drag the host is told dragging is live.
    expect(onDraggingChange).toHaveBeenLastCalledWith(true);
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 200, clientY: 410 });

    // Dropping near the left edge snaps the saved side to "left".
    expect(onPositionChange).toHaveBeenCalledTimes(1);
    const dropped = onPositionChange.mock.calls[0]?.[0] as MenuButtonPosition;
    expect(dropped.side).toBe("left");
    expect(onDraggingChange).toHaveBeenLastCalledWith(false);

    // The click that tails the drag is swallowed — no spurious press.
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
