// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import {
  METER_FLOOR_DB,
  METER_REST,
  METER_ZONES,
  formatDb,
  meterFill,
  meterTone,
  type MeterState,
} from "./levels.ts";

// A level meter: the bar, the held peak, the loudest-ever tick, the scale
// under it and the clip lamp beside it.
//
// It draws from a subscription rather than from props, because a meter moves
// sixty times a second and a component re-rendered at that rate is the wrong
// shape — the frames write straight to the DOM through refs, and React only
// runs on mount. The words are `labels`; the colours are the theme's tokens:
// the accent for a healthy level, the flag colour for a loud one, the danger
// colour for a hot one and for the lamp. The red is never the only signal —
// the lamp says CLIP in words, and a status region announces it once.

export type LevelMeterLabels = {
  /** The meter's accessible name. */
  meter: string;
  /** The lamp's word. */
  clip: string;
  /** What the status region says when the lamp comes on. */
  clipping: string;
};

const DEFAULT_LABELS: LevelMeterLabels = {
  meter: "Input level",
  clip: "CLIP",
  clipping: "The input is clipping",
};

export type LevelMeterProps = {
  /** Frames, once per animation frame: a capture's or a recorder's
   *  `subscribe`. */
  subscribe: (listener: (frame: { meter: MeterState }) => void) => () => void;
  labels?: Partial<LevelMeterLabels>;
  /** Print the scale under the bar. Defaults to on. */
  scale?: boolean;
  /** Print the reading beside the bar. Defaults to on. */
  readout?: boolean;
  className?: string;
};

/** The marks printed under the bar. */
export const METER_SCALE_DB = [-60, -40, -30, -20, -12, -6, -3, 0] as const;

const TONE_CLASS: Record<ReturnType<typeof meterTone>, string> = {
  quiet: "bg-accent/70",
  good: "bg-accent",
  loud: "bg-flag",
  hot: "bg-danger",
};

export function LevelMeter({
  subscribe,
  labels: given,
  scale = true,
  readout = true,
  className,
}: LevelMeterProps) {
  const labels = { ...DEFAULT_LABELS, ...given };
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const peak = useRef<HTMLDivElement>(null);
  const max = useRef<HTMLDivElement>(null);
  const lamp = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let lastAria = 0;
    let lastTone: string | null = null;
    let lit = false;
    const draw = (state: MeterState) => {
      const fill = meterFill(state.levelDb);
      const tone = meterTone(state.levelDb);
      if (bar.current) {
        bar.current.style.transform = `scaleX(${fill})`;
        if (tone !== lastTone) {
          for (const c of Object.values(TONE_CLASS))
            bar.current.classList.remove(...c.split(" "));
          bar.current.classList.add(...TONE_CLASS[tone].split(" "));
          lastTone = tone;
        }
      }
      if (peak.current) {
        peak.current.style.left = `${meterFill(state.peakDb) * 100}%`;
        peak.current.style.opacity = state.peakDb > METER_FLOOR_DB ? "1" : "0";
      }
      if (max.current) {
        max.current.style.left = `${meterFill(state.maxPeakDb) * 100}%`;
        max.current.style.opacity =
          state.maxPeakDb > METER_FLOOR_DB ? "1" : "0";
      }
      if (lamp.current) {
        lamp.current.dataset.on = state.clipping ? "true" : "false";
        if (state.clipping && !lit && status.current) {
          status.current.textContent = labels.clipping;
        }
        if (!state.clipping && lit && status.current)
          status.current.textContent = "";
        lit = state.clipping;
      }
      const t = Date.now();
      if (t - lastAria > 200) {
        lastAria = t;
        if (text.current) text.current.textContent = formatDb(state.levelDb);
        if (root.current) {
          root.current.setAttribute(
            "aria-valuenow",
            String(Math.round(state.levelDb)),
          );
          root.current.setAttribute(
            "aria-valuetext",
            `${formatDb(state.levelDb)} dB`,
          );
        }
      }
    };
    draw(METER_REST);
    return subscribe((frame) => draw(frame.meter));
  }, [subscribe, labels.clipping]);

  return (
    <div className={`oss-level-meter flex flex-col gap-1 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <div
          ref={root}
          role="meter"
          aria-label={labels.meter}
          aria-valuemin={METER_FLOOR_DB}
          aria-valuemax={0}
          aria-valuenow={METER_FLOOR_DB}
          className="relative h-3 flex-1 overflow-hidden rounded-sm bg-surface-2 ring-1 ring-line ring-inset"
        >
          {/* The zones, as a faint track under the bar. */}
          {METER_ZONES.map((zone) => (
            <div
              key={zone.tone}
              aria-hidden
              className="absolute inset-y-0 border-l border-line/60"
              style={{ left: `${meterFill(zone.floorDb) * 100}%` }}
            />
          ))}
          <div
            ref={bar}
            aria-hidden
            className={`absolute inset-y-0 left-0 w-full origin-left ${TONE_CLASS.quiet}`}
            style={{ transform: "scaleX(0)" }}
          />
          <div
            ref={peak}
            aria-hidden
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg-bright"
            style={{ left: 0, opacity: 0 }}
          />
          <div
            ref={max}
            aria-hidden
            className="absolute inset-y-0 w-px -translate-x-1/2 bg-muted"
            style={{ left: 0, opacity: 0 }}
          />
        </div>
        {readout && (
          <span
            ref={text}
            aria-hidden
            className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted"
          >
            {formatDb(METER_FLOOR_DB)}
          </span>
        )}
        <span
          ref={lamp}
          data-on="false"
          aria-hidden
          className="oss-clip-lamp shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold tracking-wider border-line text-muted data-[on=true]:border-danger data-[on=true]:bg-danger data-[on=true]:text-fg-bright"
        >
          {labels.clip}
        </span>
        <span
          ref={status}
          role="status"
          aria-live="polite"
          className="sr-only"
        />
      </div>
      {scale && (
        <div
          aria-hidden
          className="relative h-3 text-[9px] leading-none text-muted"
        >
          {METER_SCALE_DB.map((db) => (
            <span
              key={db}
              className="absolute -translate-x-1/2 font-mono tabular-nums"
              style={{ left: `${meterFill(db) * 100}%` }}
            >
              {db}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
