// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { matchPrefixRange, useTypeahead } from "../src/hooks/useTypeahead.ts";
import { SelectPicker } from "../src/components/SelectPicker.tsx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- matchPrefixRange (pure) ----------------------------------------------

describe("matchPrefixRange", () => {
  it("returns the matched leading slice, case-insensitively", () => {
    expect(matchPrefixRange("Dropbox", "dro")).toEqual({ start: 0, end: 3 });
  });

  it("skips the leading whitespace the matcher ignores", () => {
    expect(matchPrefixRange("  Google Drive", "goo")).toEqual({
      start: 2,
      end: 5,
    });
  });

  it("returns null for an empty query or a non-prefix", () => {
    expect(matchPrefixRange("OneDrive", "")).toBeNull();
    expect(matchPrefixRange("OneDrive", "drive")).toBeNull();
  });
});

// --- useTypeahead (hook) ---------------------------------------------------

// A minimal harness: wire the hook onto a focusable element and surface the
// last matched index + the live query as data-attributes for assertions.
function TypeaheadHarness({
  labels,
  timeoutMs,
}: {
  labels: string[];
  timeoutMs?: number;
}) {
  const [match, setMatch] = useState<number | null>(null);
  const { onKeyDown, query } = useTypeahead({
    labels,
    onMatch: setMatch,
    timeoutMs,
  });
  return (
    <div
      tabIndex={-1}
      data-testid="probe"
      data-query={query}
      data-match={match === null ? undefined : match}
      onKeyDown={onKeyDown}
    >
      probe
    </div>
  );
}

describe("useTypeahead", () => {
  it("jumps to the first option whose label starts with the buffer", () => {
    render(<TypeaheadHarness labels={["Apple", "Banana", "Cherry"]} />);
    const probe = screen.getByTestId("probe");
    fireEvent.keyDown(probe, { key: "b" });
    expect(probe.dataset.match).toBe("1");
    expect(probe.dataset.query).toBe("b");
  });

  it("accumulates keystrokes to disambiguate", () => {
    render(<TypeaheadHarness labels={["Car", "Cat", "Cab"]} />);
    const probe = screen.getByTestId("probe");
    fireEvent.keyDown(probe, { key: "c" });
    expect(probe.dataset.match).toBe("0"); // Car
    fireEvent.keyDown(probe, { key: "a" });
    fireEvent.keyDown(probe, { key: "t" });
    expect(probe.dataset.match).toBe("1"); // Cat
    expect(probe.dataset.query).toBe("cat");
  });

  it("resets the buffer after the silence timeout", () => {
    vi.useFakeTimers();
    render(<TypeaheadHarness labels={["Alpha", "Beta"]} timeoutMs={1000} />);
    const probe = screen.getByTestId("probe");
    fireEvent.keyDown(probe, { key: "b" });
    expect(probe.dataset.query).toBe("b");
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    // The buffer cleared on its own, so the next key starts a fresh search.
    expect(probe.dataset.query).toBe("");
    fireEvent.keyDown(probe, { key: "a" });
    expect(probe.dataset.match).toBe("0"); // Alpha, not "ba"
  });

  it("ignores modifier combos and skips empty labels", () => {
    render(<TypeaheadHarness labels={["", "Visible"]} />);
    const probe = screen.getByTestId("probe");
    fireEvent.keyDown(probe, { key: "v", ctrlKey: true });
    expect(probe.dataset.match).toBeUndefined();
    fireEvent.keyDown(probe, { key: "v" });
    expect(probe.dataset.match).toBe("1");
  });
});

// --- SelectPicker integration ----------------------------------------------

const PROVIDERS = [
  { value: "dropbox", label: "Dropbox" },
  { value: "gdrive", label: "Google Drive" },
  { value: "onedrive", label: "OneDrive" },
];

describe("SelectPicker type-ahead", () => {
  it("moves the highlight to a typed option and marks the match", async () => {
    function Host() {
      return (
        <SelectPicker
          value="dropbox"
          options={PROVIDERS}
          onChange={() => {}}
          ariaLabel="Provider"
        />
      );
    }
    render(<Host />);
    // Open the listbox.
    fireEvent.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");

    // Type "one" — the highlight should land on OneDrive and the matched
    // prefix should be wrapped in a <mark>.
    fireEvent.keyDown(listbox, { key: "o" });
    fireEvent.keyDown(listbox, { key: "n" });
    fireEvent.keyDown(listbox, { key: "e" });

    const oneDrive = screen.getByRole("option", { name: /OneDrive/ });
    expect(oneDrive.getAttribute("class")).toContain("bg-surface-3");
    const mark = oneDrive.querySelector("mark");
    expect(mark?.textContent).toBe("One");
  });

  it("commits the typed option on Enter", async () => {
    const onChange = vi.fn();
    render(
      <SelectPicker
        value="dropbox"
        options={PROVIDERS}
        onChange={onChange}
        ariaLabel="Provider"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.keyDown(listbox, { key: "g" }); // Google Drive
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("gdrive");
  });
});
