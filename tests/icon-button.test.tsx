// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "../src/components/IconButton.tsx";

describe("IconButton", () => {
  it("names itself for assistive tech and for the pointer", () => {
    render(<IconButton label="Settings">*</IconButton>);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.getAttribute("title")).toBe("Settings");
  });

  it("drops the tooltip when the label is already visible beside it", () => {
    render(
      <IconButton label="Settings" titled={false}>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button").getAttribute("title")).toBeNull();
  });

  it("claims neither state by default", () => {
    render(<IconButton label="Save">*</IconButton>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBeNull();
    expect(button.getAttribute("aria-haspopup")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBeNull();
  });

  it("reports a toggle with aria-pressed", () => {
    const { rerender } = render(
      <IconButton label="Star" pressed={false}>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "false",
    );
    rerender(
      <IconButton label="Star" pressed>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("reports a disclosure with haspopup + aria-expanded", () => {
    render(
      <IconButton label="Menu" expanded={false}>
        *
      </IconButton>,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-pressed")).toBeNull();
  });

  it("tints itself while it is on, either way round", () => {
    const { rerender } = render(<IconButton label="Star">*</IconButton>);
    expect(screen.getByRole("button").className).toContain("border-line");
    rerender(
      <IconButton label="Star" pressed>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button").className).toContain("border-accent");
    rerender(
      <IconButton label="Star" expanded>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button").className).toContain("border-accent");
  });

  it("forwards the ref, the click and any extra attribute", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <IconButton
        ref={ref}
        label="Save"
        onClick={onClick}
        className="ml-2"
        data-testid="save"
      >
        *
      </IconButton>,
    );
    const button = screen.getByTestId("save");
    expect(ref.current).toBe(button);
    expect(button.className).toContain("ml-2");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("never submits a form by accident", () => {
    render(<IconButton label="Save">*</IconButton>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  it("does not fire while disabled", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Save" disabled onClick={onClick}>
        *
      </IconButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
