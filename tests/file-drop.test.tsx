// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  dragHasFiles,
  dragHasFilesOfType,
  filesFromDataTransfer,
  firstFileOfType,
  useFileDrop,
  type FileDropOptions,
} from "../src/hooks/useFileDrop.ts";

// jsdom has no DragEvent constructor and no way to build a real DataTransfer,
// so drags are simulated with plain bubbling Events carrying a hand-rolled
// `dataTransfer` — the hook only reads `types` / `items` / `files` off it.
type FakeDataTransfer = {
  types: string[];
  items: { kind: string; type: string }[];
  files: File[];
  dropEffect: string;
};

function makeDt(
  files: File[] = [file("a.txt", "text/plain")],
): FakeDataTransfer {
  return {
    types: ["Files"],
    items: files.map((f) => ({ kind: "file", type: f.type })),
    files,
    dropEffect: "",
  };
}

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

function fireDrag(
  target: EventTarget,
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  dt: FakeDataTransfer | null,
): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: dt });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

// A window-level zone: no ref, the hook listens on the window itself.
function WindowZone(props: Omit<FileDropOptions, "targetRef">) {
  const { active } = useFileDrop(props);
  return <div data-testid="window-zone" data-active={active} />;
}

// An element-level zone, optionally nested inside a window-level one — the
// two-zone pattern from the hook's header comment.
function ElementZone(props: Omit<FileDropOptions, "targetRef">) {
  const ref = useRef<HTMLDivElement>(null);
  const { active } = useFileDrop({ ...props, targetRef: ref });
  return (
    <div ref={ref} data-testid="element-zone" data-active={active}>
      <span data-testid="element-child" />
    </div>
  );
}

const isActive = (el: HTMLElement) => el.getAttribute("data-active") === "true";

describe("useFileDrop", () => {
  it("activates on dragenter and delivers dropped files", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<WindowZone onDrop={onDrop} />);
    const zone = getByTestId("window-zone");

    const dropped = [file("a.vcf", "text/vcard"), file("b.csv", "text/csv")];
    fireDrag(window, "dragenter", makeDt(dropped));
    expect(isActive(zone)).toBe(true);

    const over = fireDrag(window, "dragover", makeDt(dropped));
    expect(over.defaultPrevented).toBe(true);

    fireDrag(window, "drop", makeDt(dropped));
    expect(isActive(zone)).toBe(false);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0]?.[0]).toEqual(dropped);
  });

  it("counts enter/leave depth so crossing children does not flicker", () => {
    const { getByTestId } = render(<WindowZone onDrop={() => {}} />);
    const zone = getByTestId("window-zone");

    // Enter the target, then a child of it: two enters, one leave.
    fireDrag(window, "dragenter", makeDt());
    fireDrag(window, "dragenter", makeDt());
    fireDrag(window, "dragleave", makeDt());
    expect(isActive(zone)).toBe(true);

    // Leaving for real drains the counter and drops the overlay.
    fireDrag(window, "dragleave", makeDt());
    expect(isActive(zone)).toBe(false);
  });

  it("watches an element instead of the window when given a ref", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(<ElementZone onDrop={onDrop} />);
    const zone = getByTestId("element-zone");

    fireDrag(zone, "dragenter", makeDt());
    expect(isActive(zone)).toBe(true);

    const dropped = [file("a.png", "image/png")];
    fireDrag(zone, "drop", makeDt(dropped));
    expect(isActive(zone)).toBe(false);
    expect(onDrop.mock.calls[0]?.[0]).toEqual(dropped);
  });

  it("gates both the active state and the drop on `accepts`", () => {
    const onDrop = vi.fn();
    const { getByTestId } = render(
      <WindowZone
        onDrop={onDrop}
        accepts={(dt) => dragHasFilesOfType(dt as DataTransfer, "image/")}
      />,
    );
    const zone = getByTestId("window-zone");

    const text = makeDt([file("a.txt", "text/plain")]);
    const enter = fireDrag(window, "dragenter", text);
    expect(isActive(zone)).toBe(false);
    // A rejected drag is left entirely alone — no preventDefault.
    expect(enter.defaultPrevented).toBe(false);
    fireDrag(window, "drop", text);
    expect(onDrop).not.toHaveBeenCalled();

    fireDrag(window, "dragenter", makeDt([file("a.png", "image/png")]));
    expect(isActive(zone)).toBe(true);
  });

  it("ignores a drag with no dataTransfer at all", () => {
    const { getByTestId } = render(<WindowZone onDrop={() => {}} />);
    fireDrag(window, "dragenter", null);
    expect(isActive(getByTestId("window-zone"))).toBe(false);
  });

  it("lets a claiming inner zone coexist with an outer window zone", () => {
    const onInnerDrop = vi.fn();
    const onOuterDrop = vi.fn();
    const { getByTestId } = render(
      <>
        <WindowZone onDrop={onOuterDrop} />
        <ElementZone
          onDrop={(files) => {
            const image = firstFileOfType(files, "image/");
            if (image) onInnerDrop(image);
          }}
          accepts={(dt) => dragHasFilesOfType(dt as DataTransfer, "image/")}
          claim
        />
      </>,
    );
    const outer = getByTestId("window-zone");
    const inner = getByTestId("element-zone");

    // An image drag over the inner zone is claimed: the inner overlay comes
    // up and the event never bubbles to the outer window zone.
    const image = makeDt([file("a.png", "image/png")]);
    fireDrag(inner, "dragenter", image);
    expect(isActive(inner)).toBe(true);
    expect(isActive(outer)).toBe(false);

    fireDrag(inner, "drop", image);
    expect(onInnerDrop).toHaveBeenCalledTimes(1);
    expect(onInnerDrop.mock.calls[0]?.[0]?.name).toBe("a.png");
    expect(onOuterDrop).not.toHaveBeenCalled();

    // A non-image drag falls straight through the inner zone to the outer.
    const card = makeDt([file("a.vcf", "text/vcard")]);
    fireDrag(inner, "dragenter", card);
    expect(isActive(inner)).toBe(false);
    expect(isActive(outer)).toBe(true);
    fireDrag(inner, "drop", card);
    expect(onOuterDrop).toHaveBeenCalledTimes(1);
    expect(onInnerDrop).toHaveBeenCalledTimes(1);
  });
});

describe("file-drop predicates", () => {
  it("dragHasFiles keys off the Files type entry", () => {
    expect(dragHasFiles(makeDt() as unknown as DataTransfer)).toBe(true);
    expect(
      dragHasFiles({ types: ["text/plain"] } as unknown as DataTransfer),
    ).toBe(false);
    expect(dragHasFiles(null)).toBe(false);
  });

  it("dragHasFilesOfType matches file items by MIME prefix", () => {
    const dt = makeDt([
      file("a.txt", "text/plain"),
      file("b.png", "image/png"),
    ]) as unknown as DataTransfer;
    expect(dragHasFilesOfType(dt, "image/")).toBe(true);
    expect(dragHasFilesOfType(dt, "video/")).toBe(false);
    // A file of unknown type does not match a prefix.
    const blank = makeDt([file("c.bin", "")]) as unknown as DataTransfer;
    expect(dragHasFilesOfType(blank, "image/")).toBe(false);
    expect(dragHasFilesOfType(null, "image/")).toBe(false);
  });

  it("firstFileOfType picks the first match, or null", () => {
    const a = file("a.txt", "text/plain");
    const b = file("b.png", "image/png");
    const c = file("c.jpg", "image/jpeg");
    expect(firstFileOfType([a, b, c], "image/")).toBe(b);
    expect(firstFileOfType([a], "image/")).toBeNull();
  });

  it("filesFromDataTransfer prefers files and falls back to items", () => {
    const f = file("a.png", "image/png");
    expect(
      filesFromDataTransfer(makeDt([f]) as unknown as DataTransfer),
    ).toEqual([f]);
    const itemsOnly = {
      files: [],
      items: [
        { kind: "file", type: "image/png", getAsFile: () => f },
        { kind: "string", type: "text/plain", getAsFile: () => null },
      ],
    } as unknown as DataTransfer;
    expect(filesFromDataTransfer(itemsOnly)).toEqual([f]);
    expect(filesFromDataTransfer(null)).toEqual([]);
  });
});
