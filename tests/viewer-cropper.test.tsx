// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
// jsdom ships no canvas or image decoding, so the canvas 2d context and the
// Image loader are stubbed — these tests exercise the component wiring
// (dialog chrome, slider → transform, apply → data URL), not pixel output.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bakeCrop,
  ImageCropper,
  readImageSource,
} from "../src/viewer/index.ts";

// --- stubs -----------------------------------------------------------------

/** The natural size the next FakeImage "loads" at. */
let fakeNatural = { w: 200, h: 100 };

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    this.naturalWidth = fakeNatural.w;
    this.naturalHeight = fakeNatural.h;
    queueMicrotask(() => this.onload?.());
  }
}

const ctxCalls: { name: string; args: unknown[] }[] = [];
let lastCanvasSize: { w: number; h: number } | null = null;

const fakeCtx = new Proxy(
  {},
  {
    get:
      (_target, name: string) =>
      (...args: unknown[]) => {
        ctxCalls.push({ name, args });
      },
  },
);

const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetWidth",
);

beforeEach(() => {
  fakeNatural = { w: 200, h: 100 };
  ctxCalls.length = 0;
  lastCanvasSize = null;
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fakeCtx as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    function (this: HTMLCanvasElement) {
      lastCanvasSize = { w: this.width, h: this.height };
      return "data:image/jpeg;base64,BAKED";
    },
  );
  // The square viewport measures itself through offsetWidth (0 in jsdom).
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 100,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  if (originalOffsetWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetWidth",
      originalOffsetWidth,
    );
  }
});

/** jsdom's URL ships no object-URL statics — pin fakes on for one test. */
function stubObjectUrls() {
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });
}

/** Render and flush the async natural-size image load. */
async function renderCropper(
  props: Partial<Parameters<typeof ImageCropper>[0]> = {},
) {
  const utils = render(
    <ImageCropper
      source="data:image/jpeg;base64,SRC"
      onCancel={() => {}}
      onApply={() => {}}
      {...props}
    />,
  );
  await act(async () => {});
  return utils;
}

// --- ImageCropper ------------------------------------------------------------

describe("ImageCropper", () => {
  it("renders a dialog in the Modal with its default labels", async () => {
    await renderCropper();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Adjust image")).toBeTruthy();
    expect(screen.getByLabelText("Zoom")).toBeTruthy();
    expect(screen.getByText("Apply")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("takes injected labels over the defaults", async () => {
    await renderCropper({
      labels: { title: "Justera bilden", apply: "Spara", zoom: "Zooma" },
    });
    expect(screen.getByText("Justera bilden")).toBeTruthy();
    expect(screen.getByText("Spara")).toBeTruthy();
    expect(screen.getByLabelText("Zooma")).toBeTruthy();
    // Unspecified labels keep their English defaults.
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("positions the image by the transform (cover-fit at open)", async () => {
    const { container } = await renderCropper();
    const img = container.ownerDocument.querySelector("img")!;
    // 200x100 into the 100px viewport: cover-fit → 200x100 at (-50, 0).
    expect(img.style.width).toBe("200px");
    expect(img.style.height).toBe("100px");
    expect(img.style.left).toBe("-50px");
    expect(img.style.top).toBe("0px");
  });

  it("zooms with the slider, scaling the image about the centre", async () => {
    const { container } = await renderCropper();
    const slider = screen.getByLabelText("Zoom") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "3" } });
    expect(slider.value).toBe("3");
    const img = container.ownerDocument.querySelector("img")!;
    expect(img.style.width).toBe("600px");
    expect(img.style.height).toBe("300px");
    expect(img.style.left).toBe("-250px");
    expect(img.style.top).toBe("-100px");
  });

  it("clamps the slider zoom to the scale bounds", async () => {
    await renderCropper();
    const slider = screen.getByLabelText("Zoom") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0.2" } });
    expect(slider.value).toBe("1");
  });

  it("zooms on wheel over the viewport", async () => {
    await renderCropper();
    const slider = screen.getByLabelText("Zoom") as HTMLInputElement;
    const viewport = slider
      .closest("[role='dialog']")!
      .querySelector(".touch-none")!;
    fireEvent.wheel(viewport, { deltaY: -1 });
    expect(Number(slider.value)).toBeCloseTo(1.08);
  });

  it("pans with a single captured pointer, clamped to cover", async () => {
    const { container } = await renderCropper();
    const viewport = container.ownerDocument.querySelector(".touch-none")!;
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 30, clientY: 30 });
    const img = container.ownerDocument.querySelector("img")!;
    // dx=30 over a 100px viewport → tx 0.3, x = -50 + 30 = -20; the vertical
    // pan clamps to 0 (the landscape image has no vertical slack at scale 1).
    expect(img.style.left).toBe("-20px");
    expect(img.style.top).toBe("0px");
  });

  it("applies: bakes a square data URL and returns it with the transform", async () => {
    const onApply = vi.fn();
    await renderCropper({ onApply });
    fireEvent.click(screen.getByText("Apply"));
    await act(async () => {});
    expect(onApply).toHaveBeenCalledWith({
      dataUrl: "data:image/jpeg;base64,BAKED",
      transform: { scale: 1, tx: 0, ty: 0 },
    });
    // The bake ran at the square output size (default 512).
    expect(lastCanvasSize).toEqual({ w: 512, h: 512 });
    // The framed region was drawn through the shared drawRect math.
    const draw = ctxCalls.find((c) => c.name === "drawImage");
    expect(draw?.args.slice(1)).toEqual([-256, 0, 1024, 512]);
  });

  it("bakes at a caller-supplied output size", async () => {
    const onApply = vi.fn();
    await renderCropper({ onApply, outputSize: 128 });
    fireEvent.click(screen.getByText("Apply"));
    await act(async () => {});
    expect(lastCanvasSize).toEqual({ w: 128, h: 128 });
  });

  it("cancels without applying", async () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    await renderCropper({ onCancel, onApply });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

// --- canvas helpers ------------------------------------------------------------

describe("bakeCrop", () => {
  it("clips to the inscribed circle with mask: 'circle'", async () => {
    await bakeCrop(
      "data:image/jpeg;base64,SRC",
      { scale: 1, tx: 0, ty: 0 },
      100,
      { mask: "circle" },
    );
    const arc = ctxCalls.find((c) => c.name === "arc");
    expect(arc?.args).toEqual([50, 50, 50, 0, Math.PI * 2]);
    expect(ctxCalls.some((c) => c.name === "clip")).toBe(true);
  });

  it("skips the clip by default", async () => {
    await bakeCrop("data:image/jpeg;base64,SRC", { scale: 1, tx: 0, ty: 0 });
    expect(ctxCalls.some((c) => c.name === "clip")).toBe(false);
  });
});

describe("readImageSource", () => {
  it("downscales to the max dimension and returns a data URL", async () => {
    fakeNatural = { w: 2000, h: 1000 };
    stubObjectUrls();
    const out = await readImageSource(new Blob(["x"]));
    expect(out).toBe("data:image/jpeg;base64,BAKED");
    // Longest edge capped at the default 1024, aspect kept.
    expect(lastCanvasSize).toEqual({ w: 1024, h: 512 });
  });

  it("never upscales a smaller image", async () => {
    fakeNatural = { w: 300, h: 200 };
    stubObjectUrls();
    await readImageSource(new Blob(["x"]), { maxDim: 1024 });
    expect(lastCanvasSize).toEqual({ w: 300, h: 200 });
  });
});
