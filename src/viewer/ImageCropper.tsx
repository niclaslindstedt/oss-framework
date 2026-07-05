// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../components/Button.tsx";
import { SlidersIcon } from "../components/icons.tsx";
import { Modal } from "../components/Modal.tsx";
import { bakeCrop } from "./image.ts";
import { usePanZoom } from "./usePanZoom.ts";
import { drawRect, type ViewTransform } from "./transform.ts";

// A circular-mask image cropper dialog: the source image fills a circular
// viewport, and the user drags to pan and pinches / scrolls / drags the
// slider to zoom, choosing which part the circle exposes. Apply bakes the
// framed region to a square data URL (`bakeCrop`) and hands back that plus
// the framing so it can be re-adjusted later. The transform is resolution-
// independent (see `transform.ts`), so the on-screen preview and the baked
// output always agree — the square bake loses nothing versus a disc, since
// the display rounds it with CSS.

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DEFAULT_OUTPUT_SIZE = 512;

/** Visible strings, injectable for i18n — English defaults are used for any
 *  you omit (see {@link DEFAULT_IMAGE_CROPPER_LABELS}). */
export type ImageCropperLabels = {
  title: string;
  /** The one-line gesture hint under the title. */
  hint: string;
  apply: string;
  cancel: string;
  /** Accessible name of the zoom slider. */
  zoom: string;
};

export const DEFAULT_IMAGE_CROPPER_LABELS: ImageCropperLabels = {
  title: "Adjust image",
  hint: "Drag to position the image. Pinch, scroll, or use the slider to zoom.",
  apply: "Apply",
  cancel: "Cancel",
  zoom: "Zoom",
};

type Props = {
  /** The image to frame — a data URL or any `<img>`-drawable URL. */
  source: string;
  /** The framing to open at — a previously applied transform, or null for
   *  cover-fit centred. */
  initialTransform?: ViewTransform | null;
  /** Side of the baked square output, in px. Default 512. */
  outputSize?: number;
  onCancel: () => void;
  /** Fired with the baked square data URL and the framing that produced it
   *  (keep the transform to re-open the cropper where the user left it). */
  onApply: (result: {
    dataUrl: string;
    transform: ViewTransform;
  }) => void | Promise<void>;
  labels?: Partial<ImageCropperLabels>;
};

export function ImageCropper({
  source,
  initialTransform,
  outputSize = DEFAULT_OUTPUT_SIZE,
  onCancel,
  onApply,
  labels,
}: Props) {
  const l = { ...DEFAULT_IMAGE_CROPPER_LABELS, ...labels };
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the source once to learn its natural size (the crop math needs it).
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = source;
    return () => {
      cancelled = true;
    };
  }, [source]);

  const { transform, zoomTo, handlers } = usePanZoom({
    contentSize: nat,
    viewportRef,
    initial: initialTransform,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  });

  const apply = async () => {
    setBusy(true);
    try {
      const dataUrl = await bakeCrop(source, transform, outputSize);
      await onApply({ dataUrl, transform });
    } finally {
      setBusy(false);
    }
  };

  // The image's on-screen rectangle for the current framing, in viewport px.
  const viewportSize = viewportRef.current?.offsetWidth ?? 0;
  const rect = nat
    ? drawRect(nat.w, nat.h, viewportSize, transform)
    : { x: 0, y: 0, w: 0, h: 0 };

  return (
    <Modal
      open
      onClose={onCancel}
      labelledBy={titleId}
      initialFocusRef={cancelRef}
      closeLabel={l.cancel}
      // The pan gesture must never read as the sheet's swipe-down-to-close —
      // dragging the image would drag the whole dialog away.
      swipeToClose={false}
    >
      <div className="flex flex-col gap-4 p-1">
        <h2 id={titleId} className="text-lg font-semibold text-fg-bright">
          {l.title}
        </h2>
        <p className="text-sm text-muted">{l.hint}</p>

        {/* The circular viewport. The image sits under a ring so the exposed
            disc reads as the final crop. */}
        <div
          ref={viewportRef}
          {...handlers}
          className="relative mx-auto aspect-square w-[min(78vw,20rem)] touch-none overflow-hidden rounded-full border border-line bg-surface-2 select-none"
          style={{ cursor: "grab" }}
        >
          {nat && (
            <img
              src={source}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.w}px`,
                height: `${rect.h}px`,
              }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-inset ring-white/60"
          />
        </div>

        {/* Zoom slider — the accessible path to the same zoom as
            scroll/pinch. */}
        <label className="flex items-center gap-3">
          <SlidersIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">{l.zoom}</span>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={transform.scale}
            aria-label={l.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-accent"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {l.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => void apply()}
            disabled={busy}
          >
            {l.apply}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
