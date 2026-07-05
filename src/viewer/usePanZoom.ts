// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pan/zoom gesture state over a square viewport: one-pointer drag pans,
// two-pointer pinch zooms, wheel/trackpad zooms, and a programmatic `zoomTo`
// backs an accessible slider control. The hook owns a `ViewTransform`
// (resolution-independent — see `transform.ts`) and keeps it clamped so the
// content always covers the viewport; the caller renders the content at
// `drawRect(...)` and spreads `handlers` onto the viewport element.
//
// Extracted from a consumer app's cropper so the gesture wiring lives once;
// the roadmap's fuller `ZoomPane` (cursor-anchored wheel zoom via
// `zoomAboutPoint`, overscroll paging seam) can grow on the same core.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  clampTransform,
  IDENTITY_TRANSFORM,
  type ViewTransform,
} from "./transform.ts";

/** Wheel zoom step per notch — multiplicative, so zooming feels even. */
const WHEEL_ZOOM_IN = 1.08;
const WHEEL_ZOOM_OUT = 0.92;

export type PanZoomHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onWheel: (e: ReactWheelEvent<HTMLElement>) => void;
};

export type UsePanZoomOptions = {
  /** Natural content dimensions, or null while unknown (the transform is
   *  re-clamped as soon as they arrive). */
  contentSize: { w: number; h: number } | null;
  /** The square viewport element — its `offsetWidth` converts pointer pixel
   *  deltas into resolution-independent transform units. */
  viewportRef: RefObject<HTMLElement | null>;
  /** The framing to open at; defaults to cover-fit centred. */
  initial?: ViewTransform | null;
  /** Zoom bounds over the cover baseline. Defaults 1–5. */
  minScale?: number;
  maxScale?: number;
};

export function usePanZoom({
  contentSize,
  viewportRef,
  initial,
  minScale = 1,
  maxScale = 5,
}: UsePanZoomOptions): {
  transform: ViewTransform;
  setTransform: Dispatch<SetStateAction<ViewTransform>>;
  /** Zoom to an absolute scale (bounded), keeping the centre fixed — the
   *  slider / wheel path. */
  zoomTo: (scale: number) => void;
  handlers: PanZoomHandlers;
} {
  const [transform, setTransform] = useState<ViewTransform>(
    initial ?? IDENTITY_TRANSFORM,
  );

  // Re-clamp once the content size is known, so an opening framing (or one
  // restored from an odd aspect ratio) can't sit off the viewport.
  useEffect(() => {
    if (contentSize) {
      setTransform((tr) => clampTransform(contentSize.w, contentSize.h, tr));
    }
  }, [contentSize]);

  // Live pointer state: the active pointers (for pinch), the last
  // single-pointer position (for incremental pan), and the pinch baseline.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const viewportSize = useCallback(
    () => viewportRef.current?.offsetWidth || 1,
    [viewportRef],
  );

  const zoomTo = useCallback(
    (nextScale: number) => {
      setTransform((tr) => {
        const scale = Math.min(maxScale, Math.max(minScale, nextScale));
        const next = { ...tr, scale };
        return contentSize
          ? clampTransform(contentSize.w, contentSize.h, next)
          : next;
      });
    },
    [contentSize, minScale, maxScale],
  );

  const pointerDistance = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      lastPan.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      pinch.current = { dist: pointerDistance(), scale: transform.scale };
      lastPan.current = null;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const size = viewportSize();

    if (pointers.current.size >= 2 && pinch.current) {
      const ratio = pointerDistance() / (pinch.current.dist || 1);
      zoomTo(pinch.current.scale * ratio);
      return;
    }
    if (pointers.current.size === 1 && lastPan.current && contentSize) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setTransform((tr) =>
        clampTransform(contentSize.w, contentSize.h, {
          ...tr,
          tx: tr.tx + dx / size,
          ty: tr.ty + dy / size,
        }),
      );
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [only] = pointers.current.values();
      lastPan.current = only ? { ...only } : null;
    } else if (pointers.current.size === 0) {
      lastPan.current = null;
    }
  };

  const onWheel = (e: ReactWheelEvent<HTMLElement>) => {
    zoomTo(transform.scale * (e.deltaY < 0 ? WHEEL_ZOOM_IN : WHEEL_ZOOM_OUT));
  };

  return {
    transform,
    setTransform,
    zoomTo,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onWheel,
    },
  };
}
