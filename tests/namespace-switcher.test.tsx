// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NAMESPACE,
  NamespaceSwitcher,
  type Namespace,
} from "../src/namespaces/index.ts";

const NAMESPACES: Namespace[] = [
  DEFAULT_NAMESPACE,
  { slug: "work", name: "Work", glyph: "briefcase", color: "#3b82f6" },
  { slug: "travel", name: "Travel" },
];

function renderSwitcher(
  overrides: Partial<Parameters<typeof NamespaceSwitcher>[0]> = {},
) {
  const props = {
    namespaces: NAMESPACES,
    activeNamespace: "default",
    onSwitch: vi.fn(),
    onManage: vi.fn(),
    ...overrides,
  };
  render(<NamespaceSwitcher {...props} />);
  return props;
}

describe("NamespaceSwitcher", () => {
  it("collapses to the active namespace, then expands to all", () => {
    renderSwitcher();
    // Collapsed by default: only the active row shows.
    expect(screen.queryByRole("button", { name: "Switch to Work" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show namespaces" }));
    expect(screen.getByRole("button", { name: "Switch to Work" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Switch to Travel" }),
    ).toBeTruthy();
  });

  it("starts expanded when defaultCollapsed is false", () => {
    renderSwitcher({ defaultCollapsed: false });
    expect(screen.getByRole("button", { name: "Switch to Work" })).toBeTruthy();
  });

  it("switches when a row is clicked", () => {
    const props = renderSwitcher({ defaultCollapsed: false });
    fireEvent.click(screen.getByRole("button", { name: "Switch to Work" }));
    expect(props.onSwitch).toHaveBeenCalledWith("work");
  });

  it("opens the manager from the cog", () => {
    const props = renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: "Manage namespaces" }));
    expect(props.onManage).toHaveBeenCalled();
  });

  it("stays collapsed while a drag is live", () => {
    // A drag never forces the section open: a collapsed switcher stays collapsed
    // so the user keeps the room to drop into a folder. Only the namespaces
    // already on screen (an expanded switcher) are cross-namespace targets.
    const dropZone = vi.fn((_slug: string) => ({
      ref: () => {},
      isOver: false,
      isActive: true,
    }));
    renderSwitcher({ dropZone });
    expect(screen.queryByRole("button", { name: "Switch to Work" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Switch to Travel" }),
    ).toBeNull();
    // Collapsed: no hidden row asked for a drop zone.
    expect(dropZone).not.toHaveBeenCalled();
  });

  it("wires a drop zone for every namespace but the active one", () => {
    const dropZone = vi.fn((_slug: string) => ({
      ref: () => {},
      isOver: false,
      isActive: false,
    }));
    renderSwitcher({ defaultCollapsed: false, dropZone });
    const slugs = dropZone.mock.calls.map(([slug]) => slug);
    expect(slugs).toContain("work");
    expect(slugs).toContain("travel");
    expect(slugs).not.toContain("default");
  });

  it("drops the collapse toggle when there is only one namespace", () => {
    renderSwitcher({ namespaces: [DEFAULT_NAMESPACE] });
    expect(
      screen.queryByRole("button", { name: "Show namespaces" }),
    ).toBeNull();
    // The lone namespace is shown without a toggle.
    expect(
      screen.getByRole("button", { name: "Switch to Default" }),
    ).toBeTruthy();
  });
});
