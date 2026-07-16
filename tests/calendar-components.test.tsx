// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatePicker, MonthGrid } from "../src/calendar/index.ts";

// July 2026: the 1st is a Wednesday; the 4th a Saturday.
const GRID_PROPS = {
  year: 2026,
  month: 7,
  today: "2026-07-04",
  locale: "en-US",
};

describe("MonthGrid", () => {
  it("renders the ARIA grid with localized weekday headers", () => {
    render(<MonthGrid {...GRID_PROPS} />);
    const grid = screen.getByRole("grid", { name: "July 2026" });
    expect(grid).toBeTruthy();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    // Monday-start July 2026 spans five rows + the header row.
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("marks today, selection, and speaks full day names", () => {
    render(<MonthGrid {...GRID_PROPS} selected="2026-07-10" />);
    const today = screen.getByRole("button", { name: "July 4, 2026" });
    expect(today.getAttribute("aria-current")).toBe("date");
    const selected = screen.getByRole("button", { name: "July 10, 2026" });
    expect(
      selected.closest('[role="gridcell"]')!.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("selects on click but never a disabled day", () => {
    const onSelect = vi.fn();
    render(
      <MonthGrid
        {...GRID_PROPS}
        onSelect={onSelect}
        min="2026-07-03"
        isDisabled={(key) => key === "2026-07-10"}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "July 5, 2026" }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-05");
    onSelect.mockClear();
    // Before min.
    fireEvent.click(screen.getByRole("button", { name: "July 2, 2026" }));
    // App-side veto.
    fireEvent.click(screen.getByRole("button", { name: "July 10, 2026" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("walks days with arrow keys from the seated cursor", () => {
    render(<MonthGrid {...GRID_PROPS} selected="2026-07-15" />);
    const seat = screen.getByRole("button", { name: "July 15, 2026" });
    expect(seat.tabIndex).toBe(0);
    fireEvent.keyDown(seat, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "July 16, 2026" }).tabIndex).toBe(
      0,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "July 16, 2026" }), {
      key: "ArrowDown",
    });
    expect(screen.getByRole("button", { name: "July 23, 2026" }).tabIndex).toBe(
      0,
    );
  });

  it("pages the month on PageUp / PageDown when the host can navigate", () => {
    const onMonthNav = vi.fn();
    render(<MonthGrid {...GRID_PROPS} onMonthNav={onMonthNav} />);
    const today = screen.getByRole("button", { name: "July 4, 2026" });
    fireEvent.keyDown(today, { key: "PageDown" });
    expect(onMonthNav).toHaveBeenCalledWith(1);
    fireEvent.keyDown(today, { key: "PageUp" });
    expect(onMonthNav).toHaveBeenCalledWith(-1);
  });

  it("renders the app's day markers through renderDay", () => {
    render(
      <MonthGrid
        {...GRID_PROPS}
        renderDay={(cell) =>
          cell.key === "2026-07-04" ? <span data-testid="marker" /> : null
        }
      />,
    );
    expect(screen.getByTestId("marker")).toBeTruthy();
  });
});

describe("DatePicker", () => {
  it("shows the placeholder, opens the panel, commits a pick, and closes", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    const trigger = screen.getByRole("button", { name: /pick a date/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("grid", { name: "July 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "July 10, 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-07-10");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("renders the value through the format module and localizes", () => {
    render(
      <DatePicker
        value="2026-07-10"
        onChange={() => {}}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    expect(screen.getByRole("button", { name: "Jul 10, 2026" })).toBeTruthy();
  });

  it("pages months from the header buttons", () => {
    render(
      <DatePicker
        value={null}
        onChange={() => {}}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "August 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "June 2026" })).toBeTruthy();
  });

  it("clears through the clear row when clearable", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-07-10"
        onChange={onChange}
        clearable
        today="2026-07-04"
        locale="en-US"
        labels={{ clear: "Clear date" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Jul 10, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("jumps to a month via the month grid the caption opens", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    // The caption is a button that zooms out to the twelve months of the year.
    fireEvent.click(screen.getByRole("button", { name: "July 2026" }));
    expect(screen.getByRole("grid", { name: "2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "October 2026" }));
    // Back on the day grid, now paged to the chosen month.
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeTruthy();
  });

  it("jumps a year via the year page the month grid opens", () => {
    render(
      <DatePicker
        value={null}
        onChange={() => {}}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: "July 2026" }));
    // The year caption zooms out again to a twelve-year page (2016–2027).
    fireEvent.click(screen.getByRole("button", { name: "2026" }));
    expect(screen.getByRole("grid", { name: "2016–2027" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2019" }));
    // Land back on the month grid for the chosen year.
    expect(screen.getByRole("grid", { name: "2019" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "July 2019" }));
    expect(screen.getByRole("grid", { name: "July 2019" })).toBeTruthy();
  });

  it("pages the year page and disables it past max", () => {
    render(
      <DatePicker
        value={null}
        onChange={() => {}}
        today="2026-07-04"
        max="2026-12-31"
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: "July 2026" }));
    // A month after max is not activatable.
    const nextYear = screen.getByRole("button", { name: "Next year" });
    expect(nextYear).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "2026" }));
    // The page holding max can't advance past it.
    expect(screen.getByRole("button", { name: "Next years" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous years" }));
    expect(screen.getByRole("grid", { name: "2004–2015" })).toBeTruthy();
  });

  it("re-anchors the view on the selected month when reopened", () => {
    render(
      <DatePicker
        value="2026-03-15"
        onChange={() => {}}
        today="2026-07-04"
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mar 15, 2026" }));
    expect(screen.getByRole("grid", { name: "March 2026" })).toBeTruthy();
  });
});
