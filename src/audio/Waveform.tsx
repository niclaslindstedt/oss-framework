// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

// A recording's shape, and the playhead over it.
//
// The peaks are whatever `peaksOf` or a capture's thumbnail produced —
// one number per bucket, 0…1 — drawn as mirrored bars in SVG so they scale
// with the box and stay crisp. With `onSeek` the strip is a slider: a press
// or a drag moves the playhead, and the arrow keys step it. Without one it
// is a picture.

export type WaveformProps = {
  peaks: readonly number[];
  /** The playhead, 0…1 of the length. Absent for a plain thumbnail. */
  progress?: number;
  /** Make it a slider. Called with 0…1. */
  onSeek?: (share: number) => void;
  /** The slider's accessible name. */
  label?: string;
  /** How far one arrow-key press moves, as a share. */
  step?: number;
  /** Bar width and gap, in the SVG's own units (the box is 1000 wide). */
  className?: string;
};

const W = 1000;
const H = 100;

export function Waveform({
  peaks,
  progress,
  onSeek,
  label = "Position",
  step = 0.02,
  className,
}: WaveformProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const n = Math.max(1, peaks.length);
  const slot = W / n;
  const bar = Math.max(1, slot * 0.7);
  const interactive = Boolean(onSeek);

  const shareAt = useCallback((clientX: number): number => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(shareAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!onSeek || !dragging.current) return;
    onSeek(shareAt(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Not captured.
    }
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const at = progress ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onSeek(Math.min(1, at + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onSeek(Math.max(0, at - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(1);
    }
  };

  const played =
    progress === undefined ? null : Math.max(0, Math.min(1, progress)) * W;

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role={interactive ? "slider" : "img"}
      aria-label={label}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={
        interactive ? Math.round((progress ?? 0) * 100) : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={`oss-waveform block h-full w-full ${interactive ? "cursor-pointer touch-none" : ""} ${className ?? ""}`}
      style={{ outlineOffset: 2 }}
    >
      <g className="text-muted" fill="currentColor">
        {peaks.map((p, i) => {
          const h = Math.max(2, Math.min(1, p) * H);
          return (
            <rect
              key={i}
              x={i * slot + (slot - bar) / 2}
              y={(H - h) / 2}
              width={bar}
              height={h}
              rx={Math.min(bar / 2, 2)}
            />
          );
        })}
      </g>
      {played !== null && (
        <>
          <clipPath id="oss-waveform-played">
            <rect x={0} y={0} width={played} height={H} />
          </clipPath>
          <g
            className="text-accent"
            fill="currentColor"
            clipPath="url(#oss-waveform-played)"
          >
            {peaks.map((p, i) => {
              const h = Math.max(2, Math.min(1, p) * H);
              return (
                <rect
                  key={i}
                  x={i * slot + (slot - bar) / 2}
                  y={(H - h) / 2}
                  width={bar}
                  height={h}
                  rx={Math.min(bar / 2, 2)}
                />
              );
            })}
          </g>
          <rect
            x={played - 1}
            y={0}
            width={2}
            height={H}
            className="text-fg-bright"
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
