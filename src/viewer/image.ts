// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Canvas image helpers for the viewer module: read a picked file into a
// bounded-size data URL, and bake a framed crop out to a square data URL.
// Both operate on the same resolution-independent `ViewTransform` the pure
// geometry core (`transform.ts`) defines, so the on-screen preview and the
// baked output always agree. DOM-dependent (Image + canvas) — the geometry
// itself stays in `transform.ts`.

import { drawRect, type ViewTransform } from "./transform.ts";

/** Longest edge the kept source is downscaled to, in px — big enough to
 *  re-crop crisply, small enough to keep a local-first document light. */
const DEFAULT_MAX_DIM = 1024;
/** Side of the baked square crop, in px. */
const DEFAULT_BAKE_SIZE = 512;
const DEFAULT_TYPE = "image/jpeg";
const DEFAULT_QUALITY = 0.85;

export type ReadImageOptions = {
  /** Longest output edge, in px. Default 1024. */
  maxDim?: number;
  /** Output MIME type. Default `"image/jpeg"`. */
  type?: string;
  /** Encoder quality, 0–1. Default 0.85. */
  quality?: number;
};

/** Read a picked image `File`/`Blob` and downscale it (longest edge ≤
 *  `maxDim`) to a compact data URL — the source a cropper frames or a
 *  document stores. Never upscales a smaller image. */
export async function readImageSource(
  source: Blob,
  options: ReadImageOptions = {},
): Promise<string> {
  const {
    maxDim = DEFAULT_MAX_DIM,
    type = DEFAULT_TYPE,
    quality = DEFAULT_QUALITY,
  } = options;
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      maxDim / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(type, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BakeCropOptions = {
  /** Clip the bake to the inscribed circle (`"circle"`) or keep the full
   *  square (`"none"`, the default). A square bake loses nothing when the
   *  display rounds it with CSS; a circle mask pairs naturally with
   *  `type: "image/png"`, since JPEG has no transparency. */
  mask?: "circle" | "none";
  /** Output MIME type. Default `"image/jpeg"`. */
  type?: string;
  /** Encoder quality, 0–1. Default 0.85. */
  quality?: number;
};

/** Render the framed region of a source image (a data URL or any drawable
 *  URL) to a square data URL of side `size` — the same `drawRect` math the
 *  on-screen viewport uses, evaluated at output resolution. */
export async function bakeCrop(
  source: string,
  transform: ViewTransform,
  size: number = DEFAULT_BAKE_SIZE,
  options: BakeCropOptions = {},
): Promise<string> {
  const {
    mask = "none",
    type = DEFAULT_TYPE,
    quality = DEFAULT_QUALITY,
  } = options;
  const img = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  if (mask === "circle") {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  const r = drawRect(img.naturalWidth, img.naturalHeight, size, transform);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return canvas.toDataURL(type, quality);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not read the image"));
    img.src = url;
  });
}
