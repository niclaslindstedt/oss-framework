// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  LABELED_FIELD_CLASS,
  LabeledInput,
  LabeledTextarea,
} from "../src/components/LabeledField.tsx";

describe("LabeledInput", () => {
  it("holds a local draft and commits it on blur", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <LabeledInput label="Name" value="old" onCommit={onCommit} />,
    );
    const input = getByLabelText("Name") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "new" } });
    // Typing alone never commits — the draft is local until the edit settles.
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("new");

    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("new");
  });

  it("does not commit an unchanged draft on blur", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <LabeledInput label="Name" value="same" onCommit={onCommit} />,
    );
    fireEvent.blur(getByLabelText("Name"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Enter (by blurring the field)", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <LabeledInput label="Name" value="old" onCommit={onCommit} />,
    );
    const input = getByLabelText("Name") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "typed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("typed");
    expect(document.activeElement).not.toBe(input);
  });

  it("keeps its draft when the committed value prop lags behind", () => {
    // The draft is seeded once on mount and not re-synced — an external
    // value change must remount (key) the field to replace an open draft.
    const onCommit = vi.fn();
    const { getByLabelText, rerender } = render(
      <LabeledInput label="Name" value="old" onCommit={onCommit} />,
    );
    const input = getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "draft" } });
    rerender(<LabeledInput label="Name" value="other" onCommit={onCommit} />);
    expect(input.value).toBe("draft");
  });

  it("marks a required field on the caption and flags invalid state", () => {
    const { getByLabelText, getByText } = render(
      <LabeledInput
        label="Occasion"
        value=""
        required
        invalid
        onCommit={() => {}}
      />,
    );
    expect(getByText("*")).toBeTruthy();
    const input = getByLabelText(/Occasion/) as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toBe(`${LABELED_FIELD_CLASS} border-danger`);
  });

  it("passes input attributes through", () => {
    const { getByLabelText } = render(
      <LabeledInput
        label="Site"
        value=""
        type="url"
        inputMode="url"
        autoCapitalize="none"
        placeholder="https://…"
        onCommit={() => {}}
      />,
    );
    const input = getByLabelText("Site") as HTMLInputElement;
    expect(input.type).toBe("url");
    expect(input.getAttribute("inputmode")).toBe("url");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.placeholder).toBe("https://…");
  });
});

describe("LabeledTextarea", () => {
  it("commits a changed draft on blur, and only then", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <LabeledTextarea label="Text" value="old" rows={4} onCommit={onCommit} />,
    );
    const area = getByLabelText("Text") as HTMLTextAreaElement;
    expect(area.rows).toBe(4);

    fireEvent.blur(area);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(area, { target: { value: "new" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(area);
    expect(onCommit).toHaveBeenCalledWith("new");
  });

  it("keeps the accessible name when the caption is hidden", () => {
    const { getByLabelText, queryByText } = render(
      <LabeledTextarea
        label="Text"
        hideLabel
        value=""
        rows={2}
        onCommit={() => {}}
      />,
    );
    expect(queryByText("Text")).toBeNull();
    expect(getByLabelText("Text")).toBeTruthy();
  });
});
