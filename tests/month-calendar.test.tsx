// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MonthCalendar, useDayPress } from "../src/calendar/index.ts";

// July 2026: the 1st is a Wednesday, the 5th a Sunday.
const PROPS = {
  anchor: "2026-07-05",
  today: "2026-07-04",
  locale: "en-GB",
} as const;

describe("MonthCalendar", () => {
  it("heads the grid with the anchor's month and pages from the arrows", () => {
    render(<MonthCalendar {...PROPS} />);
    expect(screen.getByText("July 2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("June 2026")).toBeTruthy();
  });

  it("steps across a year boundary", () => {
    render(<MonthCalendar {...PROPS} anchor="2026-12-15" />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("January 2027")).toBeTruthy();
  });

  it("takes the paging labels from the caller", () => {
    render(
      <MonthCalendar
        {...PROPS}
        labels={{ prevMonth: "Föregående månad", nextMonth: "Nästa månad" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Nästa månad" })).toBeTruthy();
  });

  it("reports the month it moved to, but not the one it opened on", () => {
    const onMonthChange = vi.fn();
    render(<MonthCalendar {...PROPS} onMonthChange={onMonthChange} />);
    expect(onMonthChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith("2026-08-05");
  });

  it("keeps a stable six-row height while paging", () => {
    // A grid that changes height as it steps makes everything under it jump,
    // which is why `fixedWeeks` defaults on here and not on `MonthGrid`.
    render(<MonthCalendar {...PROPS} />);
    expect(screen.getAllByRole("row")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("forwards selection and the day-marker seam to the grid", () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        {...PROPS}
        selected="2026-07-10"
        onSelect={onSelect}
        renderDay={(cell) =>
          cell.key === "2026-07-09" ? <i data-testid="mark" /> : null
        }
      />,
    );
    expect(screen.getByTestId("mark")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "9 July 2026" }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-09");
  });

  it("claims the horizontal axis so an outer swipe stands down", () => {
    const { container } = render(<MonthCalendar {...PROPS} />);
    expect(container.querySelector("[data-swipe-ignore]")).toBeTruthy();
  });
});

function Held({ onHold }: { onHold: (day: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDayPress(ref, onHold, { holdMs: 20, haptics: false });
  return (
    <div ref={ref}>
      <MonthCalendar {...PROPS} onSelect={() => {}} />
    </div>
  );
}

describe("useDayPress", () => {
  const press = (day: string) =>
    screen.getByRole("button", { name: day }).closest('[role="gridcell"]')!;

  it("fires with the day the press landed on, read off the grid's marker", async () => {
    const onHold = vi.fn();
    render(<Held onHold={onHold} />);
    const cell = press("9 July 2026");

    fireEvent.pointerDown(cell, { button: 0, clientX: 10, clientY: 10 });
    await new Promise((r) => setTimeout(r, 40));
    expect(onHold).toHaveBeenCalledWith("2026-07-09");
  });

  it("swallows the click the release would otherwise deliver", async () => {
    const onHold = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <Held onHold={onHold} />
      </div>,
    );
    const cell = press("9 July 2026");

    fireEvent.pointerDown(cell, { button: 0, clientX: 10, clientY: 10 });
    await new Promise((r) => setTimeout(r, 40));
    fireEvent.pointerUp(cell);
    fireEvent.click(cell);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("abandons a press that drifts into a drag", async () => {
    const onHold = vi.fn();
    render(<Held onHold={onHold} />);
    const cell = press("9 July 2026");

    fireEvent.pointerDown(cell, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(cell, { clientX: 60, clientY: 12 });
    await new Promise((r) => setTimeout(r, 40));
    expect(onHold).not.toHaveBeenCalled();
  });

  it("ignores a release before the hold, and a non-primary button", async () => {
    const onHold = vi.fn();
    render(<Held onHold={onHold} />);
    const cell = press("9 July 2026");

    fireEvent.pointerDown(cell, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(cell);
    fireEvent.pointerDown(cell, { button: 2, clientX: 10, clientY: 10 });
    await new Promise((r) => setTimeout(r, 40));
    expect(onHold).not.toHaveBeenCalled();
  });
});

describe("MonthCalendar cursor", () => {
  it("re-seats when the anchor moves to another month", () => {
    const { rerender } = render(<MonthCalendar {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeTruthy();

    rerender(<MonthCalendar {...PROPS} anchor="2026-10-02" />);
    expect(screen.getByText("October 2026")).toBeTruthy();
  });

  it("stays put when the anchor moves within the month on display", () => {
    // The common case: the caller selects a day, which moves the anchor. The
    // view must not snap back out from under a user who had paged away.
    const { rerender } = render(<MonthCalendar {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    rerender(<MonthCalendar {...PROPS} anchor="2026-07-20" />);
    expect(screen.getByText("August 2026")).toBeTruthy();
  });
});
