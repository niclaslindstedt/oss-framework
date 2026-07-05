// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public viewer surface. A full-screen lightbox and a circular-mask image
// cropper over a pure, DOM-free pan/zoom geometry core (`transform.ts`) —
// the math is exported on its own so an app can project custom surfaces
// through the same framing model the shipped components use.
export {
  IDENTITY_TRANSFORM,
  drawRect,
  clampTransform,
  panBy,
  zoomAboutPoint,
  fitContain,
  type ViewTransform,
  type ViewRect,
} from "./transform.ts";
export {
  readImageSource,
  bakeCrop,
  type ReadImageOptions,
  type BakeCropOptions,
} from "./image.ts";
export {
  usePanZoom,
  type UsePanZoomOptions,
  type PanZoomHandlers,
} from "./usePanZoom.ts";
export {
  Lightbox,
  DEFAULT_LIGHTBOX_LABELS,
  type LightboxItem,
  type LightboxLabels,
} from "./Lightbox.tsx";
export {
  ImageCropper,
  DEFAULT_IMAGE_CROPPER_LABELS,
  type ImageCropperLabels,
} from "./ImageCropper.tsx";
