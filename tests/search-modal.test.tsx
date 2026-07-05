// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchModal, type SearchResults } from "../src/search/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

const search = (query: string): SearchResults<string> => ({
  results: query.trim() ? [`hit for ${query.trim()}`] : [],
});

function renderModal(
  overrides: Partial<React.ComponentProps<typeof SearchModal<string>>> = {},
) {
  const onClose = vi.fn();
  const utils = render(
    <SearchModal<string> open onClose={onClose} search={search} {...overrides}>
      {(results) => results.map((r) => <li key={r}>{r}</li>)}
    </SearchModal>,
  );
  return { onClose, ...utils };
}

function input(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

async function flushAnimationFrame() {
  await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

describe("SearchModal", () => {
  it("opens empty and searches as the user types", () => {
    renderModal();

    expect(input().value).toBe("");
    expect(screen.getByText("Type to search.")).toBeTruthy();

    fireEvent.change(input(), { target: { value: "milk" } });
    expect(screen.getByText("hit for milk")).toBeTruthy();
    expect(screen.getByText("1 match")).toBeTruthy();
  });

  it("seeds the field from initialQuery and searches it immediately", async () => {
    renderModal({ initialQuery: "mi" });

    expect(input().value).toBe("mi");
    expect(screen.getByText("hit for mi")).toBeTruthy();

    // The caret parks after the seed, so the next keystroke appends.
    await flushAnimationFrame();
    expect(input().selectionStart).toBe(2);
    expect(input().selectionEnd).toBe(2);
  });

  it("reads the seed fresh on each open, not on later prop changes", () => {
    const view = renderModal({ initialQuery: "a" });
    expect(input().value).toBe("a");

    // A seed change while open must not clobber a live query.
    view.rerender(
      <SearchModal<string>
        open
        onClose={vi.fn()}
        search={search}
        initialQuery="b"
      >
        {(results) => results.map((r) => <li key={r}>{r}</li>)}
      </SearchModal>,
    );
    expect(input().value).toBe("a");

    // Close and reopen: the latest seed lands.
    view.rerender(
      <SearchModal<string>
        open={false}
        onClose={vi.fn()}
        search={search}
        initialQuery="b"
      >
        {(results) => results.map((r) => <li key={r}>{r}</li>)}
      </SearchModal>,
    );
    view.rerender(
      <SearchModal<string>
        open
        onClose={vi.fn()}
        search={search}
        initialQuery="b"
      >
        {(results) => results.map((r) => <li key={r}>{r}</li>)}
      </SearchModal>,
    );
    expect(input().value).toBe("b");
  });

  it("fires onQueryChange with the seed", () => {
    const onQueryChange = vi.fn();
    renderModal({ initialQuery: "mi", onQueryChange });

    expect(onQueryChange).toHaveBeenCalledWith("mi");
  });
});
