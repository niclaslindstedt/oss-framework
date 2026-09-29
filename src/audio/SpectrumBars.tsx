// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { useMeasuredSize } from "../hooks/useMeasuredSize.ts";

// A spectrum analyser: one bar per band on a log frequency axis, drawn on a
// canvas from a subscription, with a peak mark per bar that holds and falls.
//
// The colours are read off the element's own computed style — the theme's
// `--accent`, `--flag` and `--line` — so the bars follow the theme without
// a prop, and change with it. Under `prefers-reduced-motion` the peak marks
// are left out: the bars are information, the marks are motion.

export type SpectrumBarsProps = {
  /** Frames, once per animation frame: a capture's or a recorder's
   *  `subscribe`. */
  subscribe: (listener: (frame: { bands: Float32Array }) => void) => () => void;
  /** The frequency printed under a bar, by bar index. */
  ticks?: Array<{ band: number; label: string }>;
  /** The bar's accessible name. */
  label?: string;
  className?: string;
};

const PEAK_HOLD_MS = 500;
const PEAK_FALL_PER_S = 1.4;

export function SpectrumBars({
  subscribe,
  ticks = [],
  label = "Spectrum",
  className,
}: SpectrumBarsProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { ref: box, size } = useMeasuredSize<HTMLDivElement>();
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  useEffect(() => {
    const el = canvas.current;
    if (!el || width === 0 || height === 0) return;
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(el);
    const accent = style.getPropertyValue("--accent").trim() || "#3b82f6";
    const flag = style.getPropertyValue("--flag").trim() || "#f59e0b";
    const line = style.getPropertyValue("--line").trim() || "#444";
    const reduceMotion =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    let peaks: Float32Array | null = null;
    let held: Float32Array | null = null;
    let last = performance.now();

    const draw = (bands: Float32Array) => {
      const now = performance.now();
      const dt = Math.max(0, now - last);
      last = now;
      const n = bands.length;
      if (!peaks || peaks.length !== n) {
        peaks = new Float32Array(n);
        held = new Float32Array(n);
      }
      const w = el.width;
      const h = el.height;
      ctx.clearRect(0, 0, w, h);
      const gap = Math.max(1, Math.round(dpr));
      const barW = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const v = bands[i] ?? 0;
        const x = i * (barW + gap);
        const barH = Math.round(v * h);
        // The top tenth of the range wears the flag colour, so a bar that
        // reaches it reads as loud without the meter's red being reused.
        ctx.fillStyle = v > 0.9 ? flag : accent;
        ctx.fillRect(x, h - barH, barW, barH);
        if (!reduceMotion && held) {
          const p = peaks[i] ?? 0;
          if (v >= p) {
            peaks[i] = v;
            held[i] = 0;
          } else {
            held[i] = (held[i] ?? 0) + dt;
            const past = Math.max(0, (held[i] ?? 0) - PEAK_HOLD_MS) / 1000;
            peaks[i] = Math.max(
              v,
              p - ((PEAK_FALL_PER_S * past * dt) / 1000) * 60,
            );
          }
          const py = h - Math.round((peaks[i] ?? 0) * h);
          if ((peaks[i] ?? 0) > 0.01) {
            ctx.fillStyle = line;
            ctx.fillRect(x, Math.max(0, py - gap), barW, gap);
          }
        }
      }
    };
    draw(new Float32Array(0));
    return subscribe((frame) => draw(frame.bands));
  }, [subscribe, width, height]);

  return (
    <div className={`oss-spectrum flex flex-col gap-1 ${className ?? ""}`}>
      <div ref={box} className="relative h-full min-h-16 w-full">
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {ticks.length > 0 && (
        <div
          aria-hidden
          className="relative h-3 text-[9px] leading-none text-muted"
        >
          {ticks.map((tick) => (
            <span
              key={tick.band}
              className="absolute -translate-x-1/2 font-mono"
              style={{
                left: `${((tick.band + 0.5) / Math.max(1, bandCountFrom(ticks))) * 100}%`,
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// The ticks know their bar index but not how many bars there are; the last
// tick's band is a floor, and the caller's `bands` option is the truth. The
// layout puts 10k in the last quarter of a 40-to-16k scale, so the count is
// recovered from that rather than asked for.
function bandCountFrom(ticks: Array<{ band: number }>): number {
  const last = ticks[ticks.length - 1]?.band ?? 0;
  return Math.max(last + 1, Math.round((last + 1) / 0.92));
}
