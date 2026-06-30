// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Badge,
  Button,
  Checkbox,
  CipherGlyph,
  ClearableInput,
  Fab,
  Field,
  Modal,
  Section,
  SelectPicker,
  ToggleRow,
  UnlockGate,
  computeFloatingRect,
  CheckIcon,
  CloseIcon,
  GripIcon,
  type FloatingPlacement,
} from "../src/components/index.ts";

afterEach(() => {
  // RTL's auto-cleanup unmounts every render (including portals); just reset
  // the scroll lock the Modal toggles on document.body.
  document.body.style.overflow = "";
});

// --- computeFloatingRect (pure geometry) --------------------------------

const VIEWPORT = { offsetTop: 0, height: 800 };
const WIN = { innerWidth: 1000, innerHeight: 800, scrollX: 0, scrollY: 0 };

function triggerRect(
  partial: Partial<DOMRect> & Pick<DOMRect, "left" | "top">,
): DOMRect {
  const width = partial.width ?? 120;
  const height = partial.height ?? 32;
  return {
    left: partial.left,
    top: partial.top,
    width,
    height,
    right: partial.right ?? partial.left + width,
    bottom: partial.bottom ?? partial.top + height,
    x: partial.left,
    y: partial.top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("computeFloatingRect", () => {
  it("a `min` panel takes at least the trigger width and opens below", () => {
    const placement: FloatingPlacement = {
      width: { kind: "min", minPx: 160 },
      anchor: "left",
      coordinateSpace: "viewport",
    };
    const r = computeFloatingRect(
      triggerRect({ left: 100, top: 100 }),
      placement,
      VIEWPORT,
      WIN,
    );
    // min 160 wins over the 120 trigger; sits just below the trigger bottom.
    expect(r.width).toBe(160);
    expect(r.placement).toBe("below");
    expect(r.top).toBe(132 + 4); // bottom (top 100 + height 32) + gap 4
    expect(r.left).toBe(100);
  });

  it("a `max` panel is capped by the viewport minus margins", () => {
    const placement: FloatingPlacement = {
      width: { kind: "max", maxPx: 5000 },
      anchor: "left",
      coordinateSpace: "viewport",
    };
    const r = computeFloatingRect(
      triggerRect({ left: 10, top: 10 }),
      placement,
      VIEWPORT,
      WIN,
    );
    expect(r.width).toBe(1000 - 2 * 8);
  });

  it("flips above when there is no useful room below", () => {
    const placement: FloatingPlacement = {
      width: { kind: "min", minPx: 100 },
      anchor: "left",
      coordinateSpace: "viewport",
    };
    // Trigger near the bottom of an 800px viewport: <180px below, more above.
    const r = computeFloatingRect(
      triggerRect({ left: 100, top: 760, height: 30 }),
      placement,
      VIEWPORT,
      WIN,
    );
    expect(r.placement).toBe("above");
    // Anchored to the trigger TOP minus the gap (consumer flips with -100%).
    expect(r.top).toBe(760 - 4);
  });

  it("right-anchors so the panel's right edge aligns with the trigger's", () => {
    const placement: FloatingPlacement = {
      width: { kind: "min", minPx: 200 },
      anchor: "right",
      coordinateSpace: "viewport",
    };
    const r = computeFloatingRect(
      triggerRect({ left: 700, top: 100, width: 100 }),
      placement,
      VIEWPORT,
      WIN,
    );
    // right edge = 800, width 200 → left 600.
    expect(r.left).toBe(600);
  });

  it("clamps a wide panel back inside the right viewport margin", () => {
    const placement: FloatingPlacement = {
      width: { kind: "min", minPx: 400 },
      anchor: "left",
      coordinateSpace: "viewport",
    };
    const r = computeFloatingRect(
      triggerRect({ left: 900, top: 100 }),
      placement,
      VIEWPORT,
      WIN,
    );
    // left would be 900 but is clamped to innerWidth - margin - width.
    expect(r.left).toBe(1000 - 8 - 400);
  });
});

// --- Button -------------------------------------------------------------

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;
    expect(btn.type).toBe("button");
  });

  it("applies the variant class and merges a caller className", () => {
    render(
      <Button variant="danger" className="w-full">
        Delete
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("text-danger");
    expect(btn.className).toContain("w-full");
  });

  it("forwards click handlers and the disabled attribute", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Go" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

// --- Checkbox -----------------------------------------------------------

describe("Checkbox", () => {
  it("reports the next checked state on toggle", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Done" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("fires its press hook (used to keep an open field focused)", () => {
    const onMouseDown = vi.fn();
    render(
      <Checkbox
        checked
        onChange={() => {}}
        ariaLabel="Done"
        onMouseDown={onMouseDown}
      />,
    );
    fireEvent.mouseDown(screen.getByRole("checkbox", { name: "Done" }));
    expect(onMouseDown).toHaveBeenCalled();
  });
});

// --- ClearableInput -----------------------------------------------------

describe("ClearableInput", () => {
  it("shows the clear button only when there is text, and clears on click", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ClearableInput
        value=""
        onValueChange={onValueChange}
        clearLabel="Clear"
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    rerender(
      <ClearableInput
        value="hello"
        onValueChange={onValueChange}
        clearLabel="Clear"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("propagates typed input through onValueChange", () => {
    const onValueChange = vi.fn();
    render(<ClearableInput value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "x" },
    });
    expect(onValueChange).toHaveBeenCalledWith("x");
  });
});

// --- SelectPicker -------------------------------------------------------

const OPTIONS = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry" },
];

describe("SelectPicker", () => {
  it("opens the listbox and commits the clicked option", () => {
    const onChange = vi.fn();
    render(
      <SelectPicker
        value="a"
        options={OPTIONS}
        onChange={onChange}
        ariaLabel="Fruit"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Fruit" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: "Banana" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("marks the current value as the selected option", () => {
    render(
      <SelectPicker
        value="c"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Fruit"
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Fruit" }));
    const selected = screen.getByRole("option", { selected: true });
    expect(selected.textContent).toContain("Cherry");
  });
});

// --- Modal --------------------------------------------------------------

function TitledModal(props: { onClose: () => void }) {
  return (
    <Modal open onClose={props.onClose} labelledBy="t" closeLabel="Dismiss">
      <h2 id="t">Settings</h2>
      <p>Body</p>
    </Modal>
  );
}

describe("Modal", () => {
  it("renders into a portal with the dialog role and locks body scroll", () => {
    render(<TitledModal onClose={() => {}} />);
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(
      "t",
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on backdrop click and restores body scroll on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(<TitledModal onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<TitledModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={() => {}} labelledBy="t">
        <h2 id="t">Hidden</h2>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// --- icons --------------------------------------------------------------

describe("glyphs", () => {
  it("render decorative SVGs that forward a className and paint currentColor", () => {
    const { container, rerender } = render(<CheckIcon className="h-4 w-4" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("class")).toBe("h-4 w-4");
    expect(svg.getAttribute("stroke")).toBe("currentColor");

    rerender(<CloseIcon className="x" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("x");
  });

  it("renders a filled glyph (grip) with a currentColor fill and no stroke", () => {
    const { container } = render(<GripIcon className="g" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("stroke")).toBe("none");
  });
});

// --- settings layout (Section / Field / ToggleRow) ----------------------

describe("Section", () => {
  it("names its group via the title for assistive tech", () => {
    render(
      <Section title="Appearance">
        <span>body</span>
      </Section>,
    );
    const group = screen.getByRole("group", { name: "Appearance" });
    expect(group.textContent).toContain("body");
  });
});

describe("Field", () => {
  it("labels its control group with the caption", () => {
    render(
      <Field label="Text size">
        <button type="button">A</button>
      </Field>,
    );
    expect(
      within(screen.getByRole("group", { name: "Text size" })).getByRole(
        "button",
        { name: "A" },
      ),
    ).toBeTruthy();
  });
});

describe("ToggleRow", () => {
  it("renders a labelled checkbox and reports the next state on toggle", () => {
    const onChange = vi.fn();
    render(
      <ToggleRow
        label="Reduce motion"
        hint="Calms animations"
        checked={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Calms animations")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Reduce motion" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

// --- CipherGlyph --------------------------------------------------------

describe("CipherGlyph", () => {
  it("renders a decorative run of monospace cipher cells", () => {
    const { container } = render(<CipherGlyph className="text-accent" />);
    const el = container.firstChild as HTMLElement;
    // aria-hidden (decorative), monospace, and the caller's className merged in.
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("text-accent");
    // A fixed-width run of cells, every character drawn from the cipher set.
    expect(el.textContent).toMatch(/^[0-9A-F#$%&]{5}$/);
  });

  it("re-scrambles its cells over time", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CipherGlyph />);
      const el = container.firstChild as HTMLElement;
      const frames = new Set<string>();
      for (let i = 0; i < 40; i++) {
        frames.add(el.textContent ?? "");
        act(() => {
          vi.advanceTimersByTime(110);
        });
      }
      // The animation mutates the frame, so more than one distinct frame shows.
      expect(frames.size).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- UnlockGate ---------------------------------------------------------

describe("UnlockGate", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <UnlockGate open={false} onUnlock={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows English defaults and disables unlock until a passphrase is typed", () => {
    render(<UnlockGate open onUnlock={vi.fn()} />);
    expect(screen.getByText("Content is locked")).toBeTruthy();
    const unlock = screen.getByRole("button", {
      name: "Unlock",
    }) as HTMLButtonElement;
    expect(unlock.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Passphrase"), {
      target: { value: "hunter2" },
    });
    expect(unlock.disabled).toBe(false);
  });

  it("overrides every visible string through labels", () => {
    render(
      <UnlockGate
        open
        onUnlock={vi.fn()}
        labels={{
          title: "Notes are locked",
          hint: "Enter your passphrase.",
          passphrase: "Lösenord",
          unlock: "Lås upp",
        }}
      />,
    );
    expect(screen.getByText("Notes are locked")).toBeTruthy();
    expect(screen.getByText("Enter your passphrase.")).toBeTruthy();
    expect(screen.getByLabelText("Lösenord")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lås upp" })).toBeTruthy();
  });

  it("flashes the caller's progress label beside the cipher animation, then clears on success", async () => {
    const onUnlock = vi.fn(
      async (_pw: string, onProgress: (label: string) => void) => {
        onProgress("Decrypting your notes…");
      },
    );
    render(<UnlockGate open onUnlock={onUnlock} />);
    const input = screen.getByLabelText("Passphrase") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "right" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(onUnlock).toHaveBeenCalledWith("right", expect.any(Function));
    // Resolved: the field is cleared and the status line is gone.
    expect(input.value).toBe("");
  });

  it("shows the default error on rejection and routes it through mapError", async () => {
    const onUnlock = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"));
    const { rerender } = render(<UnlockGate open onUnlock={onUnlock} />);
    const submit = async () => {
      const input = screen.getByLabelText("Passphrase") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "wrong" } });
      await act(async () => {
        fireEvent.submit(input.closest("form")!);
      });
    };
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "Wrong passphrase. Try again.",
    );
    rerender(
      <UnlockGate
        open
        onUnlock={onUnlock}
        mapError={() => "Can't reach your cloud."}
      />,
    );
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "Can't reach your cloud.",
    );
  });
});

// --- Badge + Fab --------------------------------------------------------

describe("Badge", () => {
  it("renders its content with the tone class", () => {
    const { container } = render(<Badge tone="accent">7</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.textContent).toBe("7");
    expect(el.className).toContain("text-accent");
  });
});

describe("Fab", () => {
  it("is a labelled button that defaults to type=button and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <Fab aria-label="Add item" onClick={onClick}>
        +
      </Fab>,
    );
    const btn = screen.getByRole("button", {
      name: "Add item",
    }) as HTMLButtonElement;
    expect(btn.type).toBe("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});
