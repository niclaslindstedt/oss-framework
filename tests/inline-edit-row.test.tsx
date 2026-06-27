// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineEditRow } from "../src/components/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InlineEditRow", () => {
  it("mounts focused with the seed text selected", () => {
    render(
      <InlineEditRow
        initial="Groceries"
        placeholder="Name"
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Groceries".length);
  });

  it("commits the trimmed value on Enter", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditRow
        placeholder="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Errands  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Errands");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("commits on blur", () => {
    const onCommit = vi.fn();
    render(
      <InlineEditRow
        placeholder="Name"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Work" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith("Work");
  });

  it("cancels on Escape without committing", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditRow
        initial="Keep me"
        placeholder="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels when the trimmed value is empty", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditRow
        placeholder="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not fire twice when a blur follows an Enter commit", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditRow
        placeholder="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Once" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("does not commit after Escape, even on the trailing blur", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditRow
        initial="Seed"
        placeholder="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the leading slot and icon, and uses the placeholder as the default label", () => {
    render(
      <InlineEditRow
        placeholder="Folder name"
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        leading={<span data-testid="spacer" />}
        icon={<svg data-testid="glyph" />}
      />,
    );
    expect(screen.getByTestId("spacer")).toBeTruthy();
    expect(screen.getByTestId("glyph")).toBeTruthy();
    expect(screen.getByLabelText("Folder name")).toBeTruthy();
  });

  it("prefers an explicit ariaLabel over the placeholder", () => {
    render(
      <InlineEditRow
        placeholder="Type here"
        ariaLabel="Rename folder"
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Rename folder")).toBeTruthy();
  });
});
