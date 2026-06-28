// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ColorPalette, GlyphPicker } from "../src/glyphs/index.ts";
import { useRovingTabindex } from "../src/hooks/index.ts";

// The pickers render `role="radio"` buttons in a `role="radiogroup"`; helper
// reads them back in DOM order so a test can assert the roving Tab stop and
// where focus lands after a key press.
function buttons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}

// Non-null indexed access — every test indexes into a known-length list, and
// `noUncheckedIndexedAccess` would otherwise widen each lookup to `| undefined`.
function btn(container: HTMLElement, i: number): HTMLButtonElement {
  const b = buttons(container)[i];
  if (!b) throw new Error(`no button at index ${i}`);
  return b;
}

// Index of the single element carrying the roving Tab stop (tabIndex 0); every
// other item is -1.
function tabStop(container: HTMLElement): number {
  return buttons(container).findIndex((b) => b.tabIndex === 0);
}

describe("GlyphPicker — grid roving tabindex", () => {
  const glyphs = Array.from({ length: 10 }, (_, i) => `g${i}`);

  it("seats the single Tab stop on the clear cell when nothing is selected", () => {
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value={null}
        onChange={() => {}}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    // 11 buttons: the clear cell + 10 glyphs, exactly one is the Tab stop.
    expect(buttons(container)).toHaveLength(11);
    expect(buttons(container).filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(tabStop(container)).toBe(0);
  });

  it("seats the Tab stop on the selected glyph (offset past the clear cell)", () => {
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value="g2"
        onChange={() => {}}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    expect(tabStop(container)).toBe(3); // clear cell is 0; g2 is 1 + 2
  });

  it("ArrowRight walks the row and moves focus + the Tab stop", () => {
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value={null}
        onChange={() => {}}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    fireEvent.keyDown(btn(container, 0), { key: "ArrowRight" });
    expect(tabStop(container)).toBe(1);
    expect(document.activeElement).toBe(btn(container, 1));
  });

  it("ArrowDown jumps a full row (8 columns)", () => {
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value={null}
        onChange={() => {}}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    fireEvent.keyDown(btn(container, 0), { key: "ArrowDown" });
    expect(tabStop(container)).toBe(8);
  });

  it("Home / End jump to the first / last cell", () => {
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value="g9"
        onChange={() => {}}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    fireEvent.keyDown(btn(container, 10), { key: "Home" });
    expect(tabStop(container)).toBe(0);
    fireEvent.keyDown(btn(container, 0), { key: "End" });
    expect(tabStop(container)).toBe(10);
  });

  it("picks the focused cell through the native button (Enter/Space → click)", () => {
    let picked: string | null = "unset";
    const { container } = render(
      <GlyphPicker
        glyphs={glyphs}
        value={null}
        onChange={(g) => (picked = g)}
        noneLabel="None"
        ariaLabelPrefix="Icon"
      />,
    );
    fireEvent.click(btn(container, 3));
    expect(picked).toBe("g2");
  });
});

describe("ColorPalette — 1-D horizontal roving tabindex", () => {
  const colors = ["#a", "#b", "#c", "#d"];

  it("seats the Tab stop on the selected swatch", () => {
    const { container } = render(
      <ColorPalette
        colors={colors}
        value="#c"
        onChange={() => {}}
        ariaLabelPrefix="Colour"
      />,
    );
    expect(buttons(container).filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(tabStop(container)).toBe(2);
  });

  it("ArrowLeft wraps past the start to the last swatch", () => {
    const { container } = render(
      <ColorPalette
        colors={colors}
        value="#a"
        onChange={() => {}}
        ariaLabelPrefix="Colour"
      />,
    );
    fireEvent.keyDown(btn(container, 0), { key: "ArrowLeft" });
    expect(tabStop(container)).toBe(3);
    expect(document.activeElement).toBe(btn(container, 3));
  });

  it("ignores the vertical arrows (horizontal orientation)", () => {
    const { container } = render(
      <ColorPalette
        colors={colors}
        value="#a"
        onChange={() => {}}
        ariaLabelPrefix="Colour"
      />,
    );
    fireEvent.keyDown(btn(container, 0), { key: "ArrowDown" });
    expect(tabStop(container)).toBe(0);
  });
});

// A minimal harness exercising the 1-D hook's vertical + type-ahead path
// directly, independent of the glyph pickers.
function Listbox({ labels }: { labels: string[] }) {
  const [selected, setSelected] = useState(0);
  const { cursor, isCursorAt, registerItem, onKeyDown } = useRovingTabindex({
    itemCount: labels.length,
    initialIndex: selected,
    active: false,
    typeaheadLabels: labels,
  });
  return (
    <ul role="listbox" aria-activedescendant={`opt-${cursor}`}>
      {labels.map((label, i) => (
        <li
          key={label}
          id={`opt-${i}`}
          ref={registerItem(i)}
          role="option"
          tabIndex={isCursorAt(i) ? 0 : -1}
          aria-selected={isCursorAt(i)}
          onKeyDown={onKeyDown}
          onClick={() => setSelected(i)}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

describe("useRovingTabindex — vertical nav + type-ahead", () => {
  const labels = ["Apple", "Banana", "Cherry"];

  function selected(container: HTMLElement): number {
    return Array.from(container.querySelectorAll("li")).findIndex(
      (li) => li.getAttribute("aria-selected") === "true",
    );
  }

  function item(container: HTMLElement, i: number): HTMLLIElement {
    const li = container.querySelectorAll("li")[i];
    if (!li) throw new Error(`no list item at index ${i}`);
    return li;
  }

  it("ArrowDown advances and ArrowUp wraps to the end", () => {
    const { container } = render(<Listbox labels={labels} />);
    fireEvent.keyDown(item(container, 0), { key: "ArrowDown" });
    expect(selected(container)).toBe(1);
    fireEvent.keyDown(item(container, 1), { key: "ArrowUp" });
    expect(selected(container)).toBe(0);
    fireEvent.keyDown(item(container, 0), { key: "ArrowUp" });
    expect(selected(container)).toBe(2);
  });

  it("a printable key jumps the cursor to the first matching label", () => {
    const { container } = render(<Listbox labels={labels} />);
    fireEvent.keyDown(item(container, 0), { key: "c" });
    expect(selected(container)).toBe(2);
  });
});
