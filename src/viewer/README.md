<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/viewer`

The **media viewer** — a full-screen `Lightbox` for paging through items and a
circular-mask `ImageCropper` dialog, both built over a pure, DOM-free pan/zoom
geometry core. Pan, zoom, and lightbox are _mechanisms_; what an app shows
through them (a picture, a rendered drawing, an SVG) is the app's business —
the framework never assumes an image source.

## What it owns vs. what stays in your app

The framework owns the geometry (a resolution-independent `ViewTransform`),
the gestures (swipe paging, swipe-to-dismiss, one-pointer pan, two-pointer
pinch, wheel zoom), the canvas bake, and the accessibility wiring (arrow-key
paging, an `aria-live` counter, labelled controls). Your app owns the
sources/URLs/blobs, captions, thumbnail grids, preloading, and where the baked
crop is stored. Every visible string injects via a `labels` prop with English
defaults.

| Export                                                     | Kind       | What it is                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lightbox`                                                 | component  | Full-screen overlay paging a set of items, each a render seam (`items[].render`). Swipe/arrow-key/edge-button paging with dots and a live "n of m" counter; vertical swipe, Escape, close button, or backdrop click dismisses. Portalled; deliberately not the card `Modal`. |
| `ImageCropper`                                             | component  | Circular-mask crop dialog over the framework `Modal`: drag to pan, pinch / wheel / slider to zoom; Apply bakes the framed region to a square data URL and returns it with the transform for later re-adjustment.                                                             |
| `usePanZoom`                                               | hook       | The cropper's gesture state on its own: a clamped `ViewTransform` plus pointer/wheel `handlers` to spread on a square viewport element, and a programmatic `zoomTo` for slider controls.                                                                                     |
| `ViewTransform` / `IDENTITY_TRANSFORM`                     | type/const | A resolution-independent framing: `scale` over the cover-fit baseline, centre offsets `tx`/`ty` in viewport-side units. One set of numbers frames the on-screen preview and the canvas bake identically.                                                                     |
| `drawRect`                                                 | fn         | Where the content sits in a square viewport of side `size` for a framing — evaluate at viewport px to render, at output px to bake.                                                                                                                                          |
| `clampTransform`                                           | fn         | Clamp a framing so the content always covers the viewport (scale floored at cover; pan bounded).                                                                                                                                                                             |
| `zoomAboutPoint`                                           | fn         | Zoom keeping the content point under a viewport anchor fixed — the wheel-under-cursor / pinch-centroid invariant, in pure math.                                                                                                                                              |
| `fitContain` / `panBy`                                     | fn         | Largest centred contain-fit rect for a content/viewport pair; shift a framing by a pan delta.                                                                                                                                                                                |
| `readImageSource`                                          | fn         | Read a picked `File`/`Blob` into a bounded-size data URL (longest edge ≤ `maxDim`, default 1024) — the compact source a cropper frames or a local-first document stores.                                                                                                     |
| `bakeCrop`                                                 | fn         | Bake the framed region of a source to a square data URL of side `size` (default 512), optionally clipped to the inscribed circle (`mask: "circle"`, best with `type: "image/png"`).                                                                                          |
| `DEFAULT_LIGHTBOX_LABELS` / `DEFAULT_IMAGE_CROPPER_LABELS` | const      | The English label defaults; pass a partial `labels` to override any of them.                                                                                                                                                                                                 |

## The framing model

A `ViewTransform` carries no pixels. The viewport is a square; `scale: 1` is
the **cover-fit baseline** (the content exactly covers the square), and
`tx`/`ty` offset the content centre from the viewport centre in units of the
viewport side. `drawRect(contentW, contentH, size, t)` projects that framing
into any pixel size — the cropper renders it at viewport size and `bakeCrop`
re-evaluates it at output size, so the preview and the bake always agree, and
a stored transform re-opens exactly where the user left it.

```tsx
import {
  ImageCropper,
  Lightbox,
  readImageSource,
} from "@niclaslindstedt/oss-framework/viewer";

// Crop a picked file:
const source = await readImageSource(file); // bounded data URL
<ImageCropper
  source={source}
  initialTransform={saved ?? null}
  onCancel={close}
  onApply={({ dataUrl, transform }) => store(dataUrl, transform)}
/>;

// Page through rendered items:
<Lightbox
  items={sources.map((src) => ({
    render: () => (
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    ),
  }))}
  initialIndex={2}
  onClose={close}
/>;
```

## The contract

The `ImageCropper` paints through the theme token vocabulary like every
framework component (`bg-surface-2`, `border-line`, `text-muted`,
`accent-accent`, …); the `Lightbox` deliberately paints on fixed black/white
overlay colours — a media overlay dims to black regardless of theme. The
`Lightbox` is **not** the card `Modal`: media wants the whole screen, so it
portals its own `fixed inset-0` overlay. The `ImageCropper` composes `Modal`
with `swipeToClose={false}` so panning the image can never read as the
sheet-dismiss gesture.

## Growing here

The roadmap's fuller `ZoomPane` generalization — a standalone pan/zoom surface
for arbitrary children with cursor-anchored wheel zoom (`zoomAboutPoint` is
already exported and tested) and an `onOverscrollX` paging seam — can grow in
this module on the same core. What shipped now is the proven consumer-app
surface: the pure transform math, the canvas helpers, `usePanZoom`, the
`Lightbox`, and the `ImageCropper`.
