// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LevelMeter,
  METER_REST,
  SpectrumBars,
  Waveform,
  type CaptureFrame,
  type MeterState,
} from "../src/audio/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A frame source a test can drive by hand. */
function source() {
  const listeners = new Set<(frame: CaptureFrame) => void>();
  const frame = (
    meter: Partial<MeterState> = {},
    bands: Float32Array = new Float32Array(4),
  ): CaptureFrame => ({
    meter: { ...METER_REST, ...meter },
    bands,
    peaks: [],
    elapsedMs: 0,
    samples: new Float32Array(0),
  });
  return {
    subscribe: (listener: (frame: CaptureFrame) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (meter?: Partial<MeterState>, bands?: Float32Array) => {
      for (const l of listeners) l(frame(meter, bands));
    },
    count: () => listeners.size,
  };
}

describe("LevelMeter", () => {
  it("is a meter with a range, and moves the bar from the frames", () => {
    const src = source();
    const { unmount } = render(
      <LevelMeter subscribe={src.subscribe} labels={{ meter: "Level" }} />,
    );
    const meter = screen.getByRole("meter", { name: "Level" });
    expect(meter.getAttribute("aria-valuemin")).toBe("-60");
    expect(meter.getAttribute("aria-valuemax")).toBe("0");
    expect(src.count()).toBe(1);
    act(() => src.emit({ levelDb: -30 }));
    const bar = meter.querySelector<HTMLElement>(".origin-left");
    expect(bar?.style.transform).toBe("scaleX(0.5)");
    unmount();
    expect(src.count()).toBe(0);
  });

  it("lights the lamp and says so once when the input clips", () => {
    const src = source();
    render(
      <LevelMeter subscribe={src.subscribe} scale={false} readout={false} />,
    );
    const lamp = document.querySelector<HTMLElement>(".oss-clip-lamp")!;
    expect(lamp.dataset.on).toBe("false");
    expect(lamp.textContent).toBe("CLIP");
    act(() => src.emit({ clipping: true, levelDb: -1 }));
    expect(lamp.dataset.on).toBe("true");
    expect(screen.getByRole("status").textContent).toBe(
      "The input is clipping",
    );
    act(() => src.emit({ clipping: false }));
    expect(lamp.dataset.on).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("prints the scale", () => {
    const src = source();
    render(<LevelMeter subscribe={src.subscribe} />);
    expect(document.body.textContent).toContain("-60");
    expect(document.body.textContent).toContain("-12");
  });
});

describe("SpectrumBars", () => {
  it("renders a labelled canvas and subscribes once measured", () => {
    const src = source();
    render(
      <SpectrumBars
        subscribe={src.subscribe}
        label="Bars"
        ticks={[{ band: 0, label: "100" }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Bars" }).tagName).toBe("CANVAS");
    expect(document.body.textContent).toContain("100");
  });
});

describe("Waveform", () => {
  it("is a picture without a seek handler", () => {
    render(<Waveform peaks={[0.1, 0.5, 1]} label="Shape" />);
    const svg = screen.getByRole("img", { name: "Shape" });
    expect(svg.querySelectorAll("rect")).toHaveLength(3);
    expect(svg.getAttribute("tabindex")).toBeNull();
  });

  it("is a slider with one, seeking by pointer and by key", () => {
    const onSeek = vi.fn();
    render(
      <Waveform
        peaks={[0.2, 0.4]}
        progress={0.5}
        onSeek={onSeek}
        label="Position"
      />,
    );
    const svg = screen.getByRole("slider", { name: "Position" });
    expect(svg.getAttribute("aria-valuenow")).toBe("50");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 200,
      top: 0,
      height: 20,
      right: 300,
      bottom: 20,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    });
    (svg as unknown as { setPointerCapture: () => void }).setPointerCapture =
      () => {};
    fireEvent.pointerDown(svg, { clientX: 150, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(0.25);
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(0.52);
    fireEvent.keyDown(svg, { key: "Home" });
    expect(onSeek).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(svg, { key: "End" });
    expect(onSeek).toHaveBeenLastCalledWith(1);
  });
});
