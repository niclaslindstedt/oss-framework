// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabeledDateInput, ReorderButtons } from "../src/components/index.ts";

describe("ReorderButtons", () => {
  it("moves the row in the direction pressed", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(
      <ReorderButtons
        upLabel="Move earlier"
        downLabel="Move later"
        canMoveUp
        canMoveDown
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move earlier" }));
    fireEvent.click(screen.getByRole("button", { name: "Move later" }));
    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
  });

  it("disables the end of the list it cannot move past, keeping both controls", () => {
    render(
      <ReorderButtons
        upLabel="Move earlier"
        downLabel="Move later"
        canMoveUp={false}
        canMoveDown
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      />,
    );
    // The first row's "up" disables rather than disappearing, so the column
    // keeps its width and rows stay aligned.
    expect(
      (
        screen.getByRole("button", {
          name: "Move earlier",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Move later" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("LabeledDateInput", () => {
  it("commits on blur, only when the value changed", () => {
    const onCommit = vi.fn();
    render(
      <LabeledDateInput
        label="Birthday"
        value="1992-02-29"
        onCommit={onCommit}
      />,
    );
    const field = screen.getByLabelText("Birthday") as HTMLInputElement;
    expect(field.type).toBe("date");
    fireEvent.blur(field);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "1990-03-01" } });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledWith("1990-03-01");
  });

  it("takes an outside change in while the field is idle", () => {
    const { rerender } = render(
      <LabeledDateInput
        label="Birthday"
        value="1992-02-29"
        onCommit={() => {}}
      />,
    );
    const field = screen.getByLabelText("Birthday") as HTMLInputElement;
    rerender(
      <LabeledDateInput
        label="Birthday"
        value="2001-01-01"
        onCommit={() => {}}
      />,
    );
    expect(field.value).toBe("2001-01-01");
  });

  it("leaves an edit in progress alone", () => {
    const { rerender } = render(
      <LabeledDateInput
        label="Birthday"
        value="1992-02-29"
        onCommit={() => {}}
      />,
    );
    const field = screen.getByLabelText("Birthday") as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: "1995-06-06" } });
    // A store round-trip lands while the picker is open: the field must not be
    // re-assigned underneath it (on iOS that dismisses the wheel picker).
    rerender(
      <LabeledDateInput
        label="Birthday"
        value="2001-01-01"
        onCommit={() => {}}
      />,
    );
    expect(field.value).toBe("1995-06-06");
  });
});
