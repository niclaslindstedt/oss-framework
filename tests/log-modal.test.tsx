// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LogModal, type LogModalEntry } from "../src/logging/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

const entries: LogModalEntry[] = [
  { ts: 0, level: "info", text: "save started" },
  { ts: 0, level: "warn", text: "transient failure — retrying" },
  { ts: 0, level: "error", text: "gave up" },
];

describe("LogModal", () => {
  it("renders nothing visible while closed", () => {
    render(<LogModal open={false} entries={entries} onClose={() => {}} />);
    expect(screen.queryByText("save started")).toBeNull();
  });

  it("renders every entry's text when open", () => {
    render(<LogModal open entries={entries} onClose={() => {}} />);
    for (const e of entries) {
      expect(screen.getByText(e.text)).toBeTruthy();
    }
  });

  it("shows the empty label when there are no entries", () => {
    render(
      <LogModal
        open
        entries={[]}
        onClose={() => {}}
        labels={{ empty: "nothing here" }}
      />,
    );
    expect(screen.getByText("nothing here")).toBeTruthy();
  });

  it("uses injected labels for the title and close affordance", () => {
    render(
      <LogModal
        open
        entries={entries}
        onClose={() => {}}
        labels={{ title: "Encryption log", close: "Dismiss" }}
      />,
    );
    expect(screen.getByText("Encryption log")).toBeTruthy();
    // Both the header icon-button (aria-label) and the footer Button carry it.
    expect(screen.getAllByText("Dismiss").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Dismiss").length).toBeGreaterThan(0);
  });

  it("fires onClose from the footer button", () => {
    let closed = 0;
    render(
      <LogModal
        open
        entries={entries}
        onClose={() => {
          closed += 1;
        }}
        labels={{ close: "Close" }}
      />,
    );
    fireEvent.click(screen.getByText("Close"));
    expect(closed).toBe(1);
  });

  it("colours each level by its theme rail", () => {
    // The Modal portals to document.body, so assert against the document.
    render(<LogModal open entries={entries} onClose={() => {}} />);
    const html = document.body.innerHTML;
    expect(html).toContain("border-l-accent"); // info
    expect(html).toContain("border-l-flag"); // warn
    expect(html).toContain("border-l-danger"); // error
  });
});
