// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ColorMixer } from "../src/color/ColorMixer.tsx";
import { hsvToHex, type Hsv } from "../src/color/convert.ts";

const FIELD = { left: 100, top: 50, width: 200, height: 100 };

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  const real = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if (!(this as Element).matches?.('[role="application"]')) {
      return real.call(this);
    }
    return {
      ...FIELD,
      x: FIELD.left,
      y: FIELD.top,
      right: FIELD.left + FIELD.width,
      bottom: FIELD.top + FIELD.height,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

const RED: Hsv = { h: 0, s: 1, v: 1 };
const field = () => screen.getByRole("application");
const hue = () => screen.getByRole("slider");

describe("ColorMixer", () => {
  it("names both axes, with defaults a caller can replace", () => {
    render(<ColorMixer value={RED} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Saturation and brightness")).toBeDefined();
    expect(screen.getByLabelText("Hue")).toBeDefined();
  });

  it("takes injected labels", () => {
    render(
      <ColorMixer
        value={RED}
        onChange={vi.fn()}
        labels={{ field: "Blanda", hue: "Nyans" }}
      />,
    );
    expect(screen.getByLabelText("Blanda")).toBeDefined();
    expect(screen.getByLabelText("Nyans")).toBeDefined();
  });

  it("reads a press in the field as saturation across and value down", () => {
    const onChange = vi.fn();
    render(<ColorMixer value={RED} onChange={onChange} />);
    // A quarter across, a quarter down.
    fireEvent.pointerDown(field(), {
      pointerId: 1,
      clientX: FIELD.left + 50,
      clientY: FIELD.top + 25,
    });
    expect(onChange).toHaveBeenCalledWith({ h: 0, s: 0.25, v: 0.75 });
  });

  it("clamps a press outside the field to its edges", () => {
    const onChange = vi.fn();
    render(<ColorMixer value={RED} onChange={onChange} />);
    fireEvent.pointerDown(field(), {
      pointerId: 1,
      clientX: -500,
      clientY: -500,
    });
    expect(onChange).toHaveBeenCalledWith({ h: 0, s: 0, v: 1 });
    fireEvent.pointerDown(field(), {
      pointerId: 1,
      clientX: 5000,
      clientY: 5000,
    });
    expect(onChange).toHaveBeenLastCalledWith({ h: 0, s: 1, v: 0 });
  });

  it("tracks a drag, and ignores a hover with no button down", () => {
    const onChange = vi.fn();
    render(<ColorMixer value={RED} onChange={onChange} />);
    fireEvent.pointerMove(field(), {
      pointerId: 1,
      buttons: 0,
      clientX: FIELD.left + 10,
      clientY: FIELD.top + 10,
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(field(), {
      pointerId: 1,
      buttons: 1,
      clientX: FIELD.left + 100,
      clientY: FIELD.top + 50,
    });
    expect(onChange).toHaveBeenCalledWith({ h: 0, s: 0.5, v: 0.5 });
  });

  it("changes only the hue from the strip", () => {
    const onChange = vi.fn();
    render(<ColorMixer value={{ h: 0, s: 0.4, v: 0.6 }} onChange={onChange} />);
    fireEvent.change(hue(), { target: { value: "210" } });
    expect(onChange).toHaveBeenCalledWith({ h: 210, s: 0.4, v: 0.6 });
  });

  it("keeps the hue a nearly-black colour would have lost", () => {
    // The whole reason the value stays HSV: hex cannot carry the hue of a
    // colour with no light in it, so a round trip through it would reset the
    // strip the moment the value handle reached the bottom.
    function Live() {
      const [hsv, setHsv] = useState<Hsv>({ h: 210, s: 1, v: 1 });
      return (
        <>
          <ColorMixer value={hsv} onChange={setHsv} />
          <output>{`${Math.round(hsv.h)} ${hsvToHex(hsv)}`}</output>
        </>
      );
    }
    render(<Live />);
    // Drag to the bottom of the field: black.
    fireEvent.pointerDown(field(), {
      pointerId: 1,
      clientX: FIELD.left + FIELD.width,
      clientY: FIELD.top + FIELD.height,
    });
    expect(screen.getByRole("status").textContent).toBe("210 #000000");
    // …and back up: the hue is still 210.
    fireEvent.pointerMove(field(), {
      pointerId: 1,
      buttons: 1,
      clientX: FIELD.left + FIELD.width,
      clientY: FIELD.top,
    });
    expect(screen.getByRole("status").textContent).toBe("210 #0080ff");
  });

  it("stands down on a field that has not been laid out yet", () => {
    const onChange = vi.fn();
    const real = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    render(<ColorMixer value={RED} onChange={onChange} />);
    fireEvent.pointerDown(field(), { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onChange).not.toHaveBeenCalled();
    Element.prototype.getBoundingClientRect = real;
  });
});
