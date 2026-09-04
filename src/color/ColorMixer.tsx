// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import { hsvToHex, type Hsv } from "./convert.ts";

// The mixer: a saturation/value field with a hue strip under it — the
// arrangement every colour picker has used for thirty years, because it is the
// one where "the same colour but lighter" is a straight line.
//
// Presentational and controlled: the caller owns the colour and is handed a
// new `Hsv` on every change. It says nothing about *where* it is shown, so it
// drops into a panel, a settings row, or a dialog with no wrapper of its own —
// and it deliberately does not include a swatch grid, because which swatches
// an app offers is the app's business (`ColorPalette` in `glyphs/` is one such
// grid, and a caller can put the two together).
//
// Kept in HSV rather than hex throughout. A hex round-trip on every pointer
// move quantises the drag — pulling the value handle to the top of the field
// and back would not return the hue it started at, because a nearly-black
// colour has no hue left to round-trip — so the mixer holds the honest value
// and the caller converts once, when it stores something.

export interface ColorMixerLabels {
  /** Names the saturation/value field. */
  field: string;
  /** Names the hue strip. */
  hue: string;
}

export const DEFAULT_COLOR_MIXER_LABELS: ColorMixerLabels = {
  field: "Saturation and brightness",
  hue: "Hue",
};

export interface ColorMixerProps {
  value: Hsv;
  onChange: (next: Hsv) => void;
  labels?: Partial<ColorMixerLabels>;
  /** Height of the saturation/value field. Defaults to `h-28` (7rem). */
  fieldClassName?: string;
  className?: string;
}

export function ColorMixer({
  value,
  onChange,
  labels,
  fieldClassName = "h-28",
  className = "",
}: ColorMixerProps) {
  const text = { ...DEFAULT_COLOR_MIXER_LABELS, ...labels };
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <SaturationField
        hsv={value}
        onChange={onChange}
        label={text.field}
        className={fieldClassName}
      />
      <HueSlider
        hue={value.h}
        onChange={(h) => onChange({ ...value, h })}
        label={text.hue}
      />
    </div>
  );
}

/** The saturation / value field: white to the hue across, black down. */
function SaturationField({
  hsv,
  onChange,
  label,
  className,
}: {
  hsv: Hsv;
  onChange: (next: Hsv) => void;
  label: string;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: { clientX: number; clientY: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v =
      1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onChange({ ...hsv, s, v });
  };
  return (
    <div
      ref={ref}
      // `application` rather than `slider`: this is a two-dimensional value,
      // which no single ARIA slider can describe. The hue strip beside it is a
      // real `<input type="range">`, so the keyboard still reaches the axis
      // that most needs it.
      role="application"
      aria-label={label}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.buttons !== 0) pick(e);
      }}
      className={`relative w-full cursor-crosshair touch-none rounded border border-line ${className}`}
      style={{
        backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
        backgroundImage:
          "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
      />
    </div>
  );
}

/** The hue strip. A range input rather than a hand-rolled track: it is a
 *  one-dimensional choice, and the native control brings the keyboard and the
 *  touch target with it. */
function HueSlider({
  hue,
  onChange,
  label,
}: {
  hue: number;
  onChange: (hue: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      min={0}
      max={359}
      step={1}
      value={Math.round(hue)}
      aria-label={label}
      onChange={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      className="h-5 w-full cursor-pointer appearance-none rounded border border-line [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/40 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/40 [&::-webkit-slider-thumb]:bg-white"
      style={{
        backgroundImage:
          "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
      }}
    />
  );
}
