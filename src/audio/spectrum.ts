// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The spectrometer's arithmetic: how an analyser's frequency bins are folded
// into the bars the screen draws.
//
// An FFT hands out bins spaced evenly in hertz, and a voice does not live on
// that scale — the octave from 100 to 200 Hz is as much of a voice as the one
// from 4 to 8 kHz, and an even scale would give the second forty times the
// bars. So the bars are laid out on a *logarithmic* axis, each one covering
// the same ratio of frequencies, and a bin's energy goes to the bar its
// centre falls in. Pure: bins in, bars out, no canvas.

/** The bars' edges along the frequency axis. */
export type BandLayout = {
  /** For each bar, the first and one-past-the-last bin it folds. A bar with
   *  no bin of its own (low frequencies, where the FFT is coarser than the
   *  log scale) borrows the nearest bin, so no bar is ever dark for want of
   *  resolution. */
  bins: Array<[number, number]>;
  /** The lower edge of each bar, in Hz, plus the top edge as a last entry. */
  edgesHz: number[];
};

/** Lay `count` bars over `minHz`…`maxHz` for an analyser with `fftSize` at
 *  `sampleRate`. */
export function layoutBands(
  count: number,
  fftSize: number,
  sampleRate: number,
  minHz = 40,
  maxHz = 16_000,
): BandLayout {
  const binCount = fftSize / 2;
  const hzPerBin = sampleRate / fftSize;
  const nyquist = sampleRate / 2;
  const top = Math.min(maxHz, nyquist);
  const bottom = Math.min(minHz, top / 2);
  const ratio = Math.pow(top / bottom, 1 / count);
  const edgesHz: number[] = [];
  for (let i = 0; i <= count; i++) edgesHz.push(bottom * Math.pow(ratio, i));
  const bins: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const lo = edgesHz[i] ?? bottom;
    const hi = edgesHz[i + 1] ?? top;
    let start = Math.floor(lo / hzPerBin);
    let end = Math.floor(hi / hzPerBin);
    start = Math.max(0, Math.min(binCount - 1, start));
    end = Math.max(start + 1, Math.min(binCount, end));
    bins.push([start, end]);
  }
  return { bins, edgesHz };
}

/** The dB range the bars span: a bin at `floorDb` or below draws empty, one
 *  at `ceilDb` or above full. The analyser's own defaults are −100…−30 and
 *  read too quiet for a phone's microphone; a voice sits nearer these. */
export const SPECTRUM_FLOOR_DB = -90;
export const SPECTRUM_CEIL_DB = -20;

/** Fold one frame of analyser output — `getFloatFrequencyData`'s dB per bin
 *  — into a 0…1 height per bar. A bar takes the *loudest* bin it covers
 *  rather than the average: a bar is a peak indicator, and averaging a
 *  formant with the silence beside it hides the formant. */
export function bandLevels(
  freqDb: Float32Array,
  layout: BandLayout,
  out?: Float32Array,
): Float32Array {
  const levels = out ?? new Float32Array(layout.bins.length);
  const span = SPECTRUM_CEIL_DB - SPECTRUM_FLOOR_DB;
  for (let i = 0; i < layout.bins.length; i++) {
    const [start, end] = layout.bins[i] ?? [0, 0];
    let peak = -Infinity;
    for (let b = start; b < end; b++) {
      const v = freqDb[b];
      if (v !== undefined && v > peak) peak = v;
    }
    const share = (peak - SPECTRUM_FLOOR_DB) / span;
    levels[i] = share > 1 ? 1 : share > 0 ? share : 0;
  }
  return levels;
}

/** Ease the bars from one frame to the next: up at once, down on a slope,
 *  so a consonant's burst shows and a vowel's fall is a fall. `decayPerS` is
 *  the share of the bar's height lost per second when the signal is gone. */
export function smoothBands(
  prev: Float32Array,
  next: Float32Array,
  dtMs: number,
  decayPerS = 3,
): Float32Array {
  const fall = Math.min(1, (decayPerS * Math.max(0, dtMs)) / 1000);
  for (let i = 0; i < next.length; i++) {
    const was = prev[i] ?? 0;
    const now = next[i] ?? 0;
    prev[i] = now >= was ? now : was - (was - now) * fall;
  }
  return prev;
}

/** The bars that carry a printed frequency under them, and what it says:
 *  a hundred, a thousand and ten thousand hertz, where the log scale puts
 *  them. */
export function bandTicks(
  layout: BandLayout,
): Array<{ band: number; label: string }> {
  const ticks: Array<{ band: number; label: string }> = [];
  for (const hz of [100, 1000, 10_000]) {
    const band = layout.edgesHz.findIndex((edge, i) => {
      const next = layout.edgesHz[i + 1];
      return next !== undefined && edge <= hz && hz < next;
    });
    if (band >= 0) {
      ticks.push({ band, label: hz >= 1000 ? `${hz / 1000}k` : String(hz) });
    }
  }
  return ticks;
}
