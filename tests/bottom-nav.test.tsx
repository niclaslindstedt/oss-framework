// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge, BottomNav, stepDirection } from "../src/components/index.ts";

const Dot = ({ className }: { className?: string }) => (
  <svg className={className} data-testid="glyph" />
);

const ITEMS = [
  { id: "home", label: "Home", icon: Dot },
  { id: "browse", label: "Browse", icon: Dot },
  { id: "stats", label: "Stats", icon: Dot },
] as const;

describe("BottomNav", () => {
  it("renders one button per destination, in order", () => {
    render(<BottomNav items={ITEMS} active="home" onSelect={() => {}} />);
    const tabs = screen.getAllByRole("button");
    expect(tabs.map((b) => b.textContent)).toEqual(["Home", "Browse", "Stats"]);
  });

  it("marks the active destination as the current page", () => {
    render(<BottomNav items={ITEMS} active="browse" onSelect={() => {}} />);
    expect(
      screen
        .getByRole("button", { name: "Browse" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: "Home" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("lights nothing when the screen on display is not on the bar", () => {
    render(<BottomNav items={ITEMS} active="settings" onSelect={() => {}} />);
    for (const tab of screen.getAllByRole("button")) {
      expect(tab.getAttribute("aria-current")).toBeNull();
    }
  });

  it("hands the id to onSelect", () => {
    const onSelect = vi.fn();
    render(<BottomNav items={ITEMS} active="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(onSelect).toHaveBeenCalledWith("stats");
  });

  it("names the bar and renders a badge when one is given", () => {
    render(
      <BottomNav
        items={[{ ...ITEMS[1], badge: <Badge>3</Badge> }]}
        active="browse"
        onSelect={() => {}}
        label="Ledger"
      />,
    );
    expect(screen.getByRole("navigation", { name: "Ledger" })).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("stepDirection", () => {
  const order: string[] = ["a", "b", "c"];

  it("reads a move along the axis as the direction it travels", () => {
    expect(stepDirection(order, "a", "b")).toBe("forward");
    expect(stepDirection(order, "a", "c")).toBe("forward");
    expect(stepDirection(order, "c", "a")).toBe("back");
  });

  it("gives a move that is not along the axis no direction at all", () => {
    expect(stepDirection(order, "b", "b")).toBe("none");
    // Either end off the bar — a screen reached from somewhere else.
    expect(stepDirection(order, "b", "settings")).toBe("none");
    expect(stepDirection(order, "settings", "b")).toBe("none");
    expect(stepDirection(order, "settings", "search")).toBe("none");
  });
});
