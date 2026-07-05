// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure, DOM-free pan/zoom geometry — the core the viewer components render
// through. Everything here is **resolution-independent**: a `ViewTransform`
// carries no pixels, so one set of numbers frames the same region in a small
// on-screen viewport and in a large canvas bake, and re-opening a saved
// framing lands exactly where the user left it.
//
// The model (ported from a consumer app's proven crop math):
//
// - The viewport is a **square** of side `size`; the content is a rectangle
//   of natural dimensions `contentW × contentH`.
// - The baseline framing **cover-fits** the content: at `scale` 1 the content
//   exactly covers the square (the shorter edge flush), so the viewport can
//   never expose a blank margin while `scale ≥ 1`.
// - `tx` / `ty` are the offset of the **content centre from the viewport
//   centre, in units of the viewport side** — `tx: 0.5` means "shifted right
//   by half a viewport", whatever the viewport's pixel size.

/** A resolution-independent framing: zoom factor over the cover-fit baseline
 *  plus a centre offset in viewport-side units. */
export type ViewTransform = {
  /** Zoom over the cover-fit baseline; `1` = exactly covering. */
  scale: number;
  /** Horizontal offset of the content centre, in viewport-side units. */
  tx: number;
  /** Vertical offset of the content centre, in viewport-side units. */
  ty: number;
};

/** An axis-aligned rectangle in whatever pixel space the caller asked for. */
export type ViewRect = { x: number; y: number; w: number; h: number };

/** The neutral framing content opens at: cover-fit, centred. */
export const IDENTITY_TRANSFORM: ViewTransform = { scale: 1, tx: 0, ty: 0 };

/** The scale drawing math floors to — below the cover baseline the viewport
 *  would expose blank margin, so an under-1 scale renders as 1. */
function effectiveScale(scale: number): number {
  return Math.max(scale, 1);
}

/** Where the content sits inside a square viewport of side `size`, for a
 *  given framing. Shared by an on-screen viewport (viewport px) and a canvas
 *  bake (output px): pass the size, get the draw rectangle. The cover-fit
 *  baseline guarantees the content always covers the square at `scale ≥ 1`. */
export function drawRect(
  contentW: number,
  contentH: number,
  size: number,
  transform: ViewTransform,
): ViewRect {
  const cover = Math.max(size / contentW, size / contentH);
  const s = cover * effectiveScale(transform.scale);
  const w = contentW * s;
  const h = contentH * s;
  return {
    x: (size - w) / 2 + transform.tx * size,
    y: (size - h) / 2 + transform.ty * size,
    w,
    h,
  };
}

/** Clamp a framing so the content still fully covers the square viewport —
 *  the pan can't drag an edge past the viewport centre line, and the scale
 *  can't drop below the cover baseline. Keeps a pan/zoom surface honest. */
export function clampTransform(
  contentW: number,
  contentH: number,
  transform: ViewTransform,
): ViewTransform {
  const scale = effectiveScale(transform.scale);
  const cover = Math.max(1 / contentW, 1 / contentH); // size factored out (=1)
  const w = contentW * cover * scale;
  const h = contentH * cover * scale;
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1) / 2);
  return {
    scale,
    tx: Math.min(maxX, Math.max(-maxX, transform.tx)),
    ty: Math.min(maxY, Math.max(-maxY, transform.ty)),
  };
}

/** Shift a framing by a pan delta, in viewport-side units (`dx = pixelDx /
 *  viewportSide`). Unclamped — compose with {@link clampTransform}. */
export function panBy(
  transform: ViewTransform,
  dx: number,
  dy: number,
): ViewTransform {
  return { ...transform, tx: transform.tx + dx, ty: transform.ty + dy };
}

/** Zoom to `nextScale` keeping the content point under `anchor` fixed on
 *  screen — the wheel-under-cursor / pinch-about-centroid invariant. The
 *  anchor is a viewport point in **viewport fractions** (`{x: 0, y: 0}` =
 *  top-left corner, `{x: 0.5, y: 0.5}` = centre), so the math needs no pixel
 *  size. Unclamped — compose with {@link clampTransform}. */
export function zoomAboutPoint(
  transform: ViewTransform,
  nextScale: number,
  anchor: { x: number; y: number },
): ViewTransform {
  // The drawing math floors scale at the cover baseline, so the on-screen
  // growth ratio is between the *effective* scales — using raw scales here
  // would drift the anchor whenever a zoom crosses the floor.
  const ratio = effectiveScale(nextScale) / effectiveScale(transform.scale);
  const ax = anchor.x - 0.5;
  const ay = anchor.y - 0.5;
  return {
    scale: nextScale,
    tx: ax - ratio * (ax - transform.tx),
    ty: ay - ratio * (ay - transform.ty),
  };
}

/** The largest rectangle with the content's aspect ratio that fits inside a
 *  `viewportW × viewportH` box, centred — the lightbox's "natural size,
 *  capped to the viewport" fit. Degenerate inputs yield an empty rect. */
export function fitContain(
  contentW: number,
  contentH: number,
  viewportW: number,
  viewportH: number,
): ViewRect {
  if (contentW <= 0 || contentH <= 0 || viewportW <= 0 || viewportH <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const s = Math.min(viewportW / contentW, viewportH / contentH);
  const w = contentW * s;
  const h = contentH * s;
  return { x: (viewportW - w) / 2, y: (viewportH - h) / 2, w, h };
}
