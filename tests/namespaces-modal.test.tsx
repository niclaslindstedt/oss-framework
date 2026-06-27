// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../src/components/index.ts";
import {
  DEFAULT_NAMESPACE,
  NamespacesModal,
  type Namespace,
} from "../src/namespaces/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

const NAMESPACES: Namespace[] = [
  DEFAULT_NAMESPACE,
  { slug: "work", name: "Work", glyph: "briefcase", color: "#3b82f6" },
];

function renderModal(
  overrides: Partial<Parameters<typeof NamespacesModal>[0]> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    namespaces: NAMESPACES,
    activeNamespace: "default",
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onSetAppearance: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<NamespacesModal {...props} />);
  return props;
}

describe("NamespacesModal", () => {
  it("lists every namespace and marks the default badge", () => {
    renderModal();
    expect(screen.getByText("Work")).toBeTruthy();
    // "Default" appears twice — the default namespace's name and its badge pill.
    expect(screen.getAllByText("Default").length).toBe(2);
  });

  it("switches when a row is clicked", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Work" }));
    expect(props.onSwitch).toHaveBeenCalledWith("work");
  });

  it("creates a namespace from the new-namespace form", () => {
    const props = renderModal();
    const input = screen.getByLabelText("Namespace name");
    fireEvent.change(input, { target: { value: "Travel" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(props.onCreate).toHaveBeenCalledWith("Travel", {
      glyph: null,
      color: null,
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("blocks a blank create and shows the validation message", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(props.onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("required");
  });

  it("renames through the edit form", () => {
    const props = renderModal();
    // The Work row's rename (pencil) button.
    const workRow = screen
      .getByRole("button", { name: "Switch to Work" })
      .closest("li") as HTMLElement;
    fireEvent.click(within(workRow).getByRole("button", { name: "Rename" }));
    const input = screen.getAllByLabelText("Namespace name")[0] as HTMLElement;
    fireEvent.change(input, { target: { value: "Office" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onRename).toHaveBeenCalledWith("work", "Office");
  });

  it("honours injected labels", () => {
    renderModal({ labels: { heading: "Profiler", create: "Skapa" } });
    expect(screen.getByText("Profiler")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skapa" })).toBeTruthy();
  });

  it("offers no delete button for the default namespace", () => {
    renderModal();
    const defaultRow = screen
      .getByRole("button", { name: "Switch to Default" })
      .closest("li") as HTMLElement;
    expect(
      within(defaultRow).queryByRole("button", { name: "Delete namespace" }),
    ).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("renders the title and runs cancel", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete it?"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Delete it?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("is absent when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        confirmLabel="Go"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});
