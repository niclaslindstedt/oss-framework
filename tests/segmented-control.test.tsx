// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "../src/components/index.ts";

describe("SegmentedControl", () => {
  const OPTIONS = [
    { value: "swipe", label: "Right-swipe" },
    { value: "button", label: "Floating button" },
  ] as const;

  it("marks the active option checked and the others unchecked", () => {
    render(
      <SegmentedControl
        value="swipe"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Open the menu with"
      />,
    );
    const group = screen.getByRole("radiogroup", {
      name: "Open the menu with",
    });
    expect(group).toBeTruthy();
    const active = screen.getByRole("radio", { name: "Right-swipe" });
    const other = screen.getByRole("radio", { name: "Floating button" });
    expect(active.getAttribute("aria-checked")).toBe("true");
    expect(other.getAttribute("aria-checked")).toBe("false");
  });

  it("reports the picked value and does not fire for a disabled option", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="swipe"
        options={[
          { value: "swipe", label: "Right-swipe" },
          { value: "button", label: "Floating button", disabled: true },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Floating button" }));
    expect(onChange).not.toHaveBeenCalled();

    render(
      <SegmentedControl value="swipe" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.click(
      screen.getAllByRole("radio", { name: "Floating button" })[1]!,
    );
    expect(onChange).toHaveBeenCalledWith("button");
  });

  it("sizes to content by default and splits the width when fullWidth", () => {
    const { rerender } = render(
      <SegmentedControl
        value="swipe"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="menu"
      />,
    );
    let group = screen.getByRole("radiogroup", { name: "menu" });
    expect(group.className).toContain("inline-flex");
    expect(group.className).toContain("w-fit");
    expect(
      screen.getByRole("radio", { name: "Right-swipe" }).className,
    ).not.toContain("flex-1");

    rerender(
      <SegmentedControl
        value="swipe"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="menu"
        fullWidth
      />,
    );
    group = screen.getByRole("radiogroup", { name: "menu" });
    expect(group.className).toContain("w-full");
    for (const r of screen.getAllByRole("radio")) {
      expect(r.className).toContain("flex-1");
      expect(r.className).toContain("justify-center");
    }
  });
});
