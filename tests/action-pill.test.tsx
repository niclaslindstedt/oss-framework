// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionPill, AnchoredFlash } from "../src/components/index.ts";

// Both components measure an anchor, and jsdom lays nothing out, so hand them
// a box to hang off.
function anchor(box: Partial<DOMRect>) {
  const el = document.createElement("div");
  document.body.append(el);
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: 100,
    right: 300,
    top: 200,
    bottom: 260,
    width: 200,
    height: 60,
    x: 100,
    y: 200,
    toJSON: () => ({}),
    ...box,
  } as DOMRect);
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = el;
  return ref;
}

describe("ActionPill", () => {
  const ACTIONS = [
    { label: "Copy", tone: "link" as const, onSelect: () => {} },
    { label: "Paste", onSelect: () => {} },
  ];

  it("centres itself on the anchor's measured box", () => {
    render(
      <ActionPill
        open
        anchorRef={anchor({ left: 100, right: 300, top: 200 })}
        actions={ACTIONS}
        onDismiss={() => {}}
      />,
    );
    const pill = screen.getByRole("group", { name: "Actions" });
    expect(pill.style.left).toBe("200px");
    expect(pill.style.top).toBe("212px");
  });

  it("fades out rather than unmounting, and stops taking presses closed", () => {
    const onSelect = vi.fn();
    render(
      <ActionPill
        open={false}
        anchorRef={anchor({})}
        actions={[{ label: "Copy", onSelect }]}
        onDismiss={() => {}}
      />,
    );
    const pill = screen.getByRole("group", { hidden: true });
    expect(pill.className).toContain("opacity-0");
    expect(pill.getAttribute("aria-hidden")).toBe("true");
    expect(
      (screen.getByRole("button", { hidden: true }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("fires the pressed verb and dims a disabled one without dropping it", () => {
    const onSelect = vi.fn();
    render(
      <ActionPill
        open
        anchorRef={anchor({})}
        actions={[
          { label: "Copy", onSelect },
          { label: "Paste", disabled: true, onSelect: () => {} },
        ]}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onSelect).toHaveBeenCalledOnce();
    const paste = screen.getByRole("button", {
      name: "Paste",
    }) as HTMLButtonElement;
    expect(paste.disabled).toBe(true);
  });

  it("takes a spoken name of its own for a half", () => {
    render(
      <ActionPill
        open
        anchorRef={anchor({})}
        actions={[
          { label: "Paste", ariaLabel: "Paste 1234.56", onSelect: () => {} },
        ]}
        ariaLabel="Clipboard"
        onDismiss={() => {}}
      />,
    );
    screen.getByRole("group", { name: "Clipboard" });
    screen.getByRole("button", { name: "Paste 1234.56" });
  });

  it("dismisses on Escape while open", () => {
    const onDismiss = vi.fn();
    render(
      <ActionPill
        open
        anchorRef={anchor({})}
        actions={ACTIONS}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("AnchoredFlash", () => {
  it("says nothing at all with no label", () => {
    const { container } = render(
      <AnchoredFlash label={null} anchorRef={anchor({})} />,
    );
    expect(container.textContent).toBe("");
    expect(document.querySelector("[role='status']")).toBeNull();
  });

  it("rides the anchor's top edge, inset from its right", () => {
    render(
      <AnchoredFlash
        label="Copied"
        anchorRef={anchor({ right: 300, top: 200 })}
      />,
    );
    const flash = screen.getByRole("status");
    expect(flash.textContent).toBe("Copied");
    // window.innerWidth is jsdom's 1024: 1024 - 300 + 16.
    expect(flash.style.right).toBe("740px");
    expect(flash.style.top).toBe("200px");
    expect(flash.className).toContain("-translate-y-1/2");
  });

  it("drops inside the anchor rather than off the top of the screen", () => {
    render(
      <AnchoredFlash
        label="Copied"
        anchorRef={anchor({ top: 4, bottom: 64 })}
      />,
    );
    const flash = screen.getByRole("status");
    expect(flash.style.top).toBe("8px");
    expect(flash.className).not.toContain("-translate-y-1/2");
  });
});
