// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  CLIP_HOLD_MS,
  METER_FLOOR_DB,
  METER_REST,
  PEAK_HOLD_MS,
  formatDb,
  meterFill,
  meterTone,
  readFrame,
  stepMeter,
  toDb,
} from "../src/audio/levels.ts";
import {
  RunningPeaks,
  durationOf,
  interleave,
  peaksOf,
  quantize,
  resample,
  toMono,
  type Pcm,
} from "../src/audio/pcm.ts";
import {
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
  bandLevels,
  bandTicks,
  layoutBands,
  smoothBands,
} from "../src/audio/spectrum.ts";
import { decodeWav, encodeWav } from "../src/audio/wav.ts";

const full = (n: number, v: number) => new Float32Array(n).fill(v);

describe("levels", () => {
  it("reads dBFS off an amplitude", () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(toDb(0)).toBe(METER_FLOOR_DB);
    expect(toDb(1e-9)).toBe(METER_FLOOR_DB);
  });

  it("fills the bar from the floor to full scale", () => {
    expect(meterFill(METER_FLOOR_DB)).toBe(0);
    expect(meterFill(0)).toBe(1);
    expect(meterFill(-30)).toBeCloseTo(0.5);
    expect(meterFill(6)).toBe(1);
  });

  it("names the zones", () => {
    expect(meterTone(-40)).toBe("quiet");
    expect(meterTone(-18)).toBe("good");
    expect(meterTone(-6)).toBe("loud");
    expect(meterTone(-2)).toBe("hot");
  });

  it("reads a frame's RMS, peak and clipping", () => {
    const frame = readFrame(full(1024, 0.5));
    expect(frame.rmsDb).toBeCloseTo(-6.02, 1);
    expect(frame.peakDb).toBeCloseTo(-6.02, 1);
    expect(frame.clipped).toBe(false);

    // One full-scale sample is a transient, not a clip.
    const one = new Float32Array(1024);
    one[10] = 1;
    expect(readFrame(one).clipped).toBe(false);

    // Three in a row is a wave with its top cut off.
    const run = new Float32Array(1024);
    run.set([1, -1, 0.99], 100);
    expect(readFrame(run).clipped).toBe(true);
  });

  it("holds the peak, then lets it fall; latches the clip lamp", () => {
    let m = stepMeter(METER_REST, readFrame(full(256, 0.5)), 16);
    expect(m.levelDb).toBeCloseTo(-6.02, 1);
    expect(m.peakDb).toBeCloseTo(-6.02, 1);
    const silent = readFrame(full(256, 0));
    m = stepMeter(m, silent, PEAK_HOLD_MS / 2);
    // Still held.
    expect(m.peakDb).toBeCloseTo(-6.02, 1);
    // The bar has started down.
    expect(m.levelDb).toBeLessThan(-6.02);
    m = stepMeter(m, silent, PEAK_HOLD_MS);
    expect(m.peakDb).toBeLessThan(-6.02);
    expect(m.peakDb).toBeGreaterThan(METER_FLOOR_DB);

    const clipped = readFrame(full(256, 1));
    m = stepMeter(m, clipped, 16);
    expect(m.clipping).toBe(true);
    expect(m.clipCount).toBe(1);
    expect(m.maxPeakDb).toBe(0);
    m = stepMeter(m, silent, CLIP_HOLD_MS - 1);
    expect(m.clipping).toBe(true);
    m = stepMeter(m, silent, 2);
    expect(m.clipping).toBe(false);
    expect(m.clipCount).toBe(1);
  });

  it("prints a reading", () => {
    expect(formatDb(-12.34)).toBe("−12.3");
    expect(formatDb(0)).toBe("0.0");
    expect(formatDb(METER_FLOOR_DB)).toBe("−∞");
    expect(formatDb(1.5)).toBe("+1.5");
  });
});

describe("spectrum", () => {
  const layout = layoutBands(32, 2048, 48000);

  it("lays bars out on a log axis with no gaps", () => {
    expect(layout.bins).toHaveLength(32);
    expect(layout.edgesHz).toHaveLength(33);
    expect(layout.edgesHz[0]).toBeCloseTo(40);
    expect(layout.edgesHz[32]).toBeCloseTo(16000);
    // Each bar covers the same ratio.
    const ratio = layout.edgesHz[1]! / layout.edgesHz[0]!;
    expect(layout.edgesHz[17]! / layout.edgesHz[16]!).toBeCloseTo(ratio);
    for (const [start, end] of layout.bins) {
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(1024);
    }
  });

  it("gives each bar the loudest bin it covers, scaled to the range", () => {
    const freq = new Float32Array(1024).fill(-Infinity);
    const [start] = layout.bins[10]!;
    freq[start] = SPECTRUM_CEIL_DB;
    const levels = bandLevels(freq, layout);
    expect(levels[10]).toBe(1);
    expect(levels[0]).toBe(0);
    freq[start] = (SPECTRUM_CEIL_DB + SPECTRUM_FLOOR_DB) / 2;
    expect(bandLevels(freq, layout)[10]).toBeCloseTo(0.5);
  });

  it("rises at once and falls on a slope", () => {
    const prev = new Float32Array([0, 1]);
    const next = new Float32Array([1, 0]);
    const out = smoothBands(prev, next, 100, 3);
    expect(out[0]).toBe(1);
    expect(out[1]).toBeCloseTo(0.7);
  });

  it("puts a tick at a hundred, a thousand and ten thousand hertz", () => {
    const ticks = bandTicks(layout);
    expect(ticks.map((t) => t.label)).toEqual(["100", "1k", "10k"]);
    expect(ticks[0]!.band).toBeLessThan(ticks[1]!.band);
  });
});

describe("pcm", () => {
  const stereo: Pcm = {
    sampleRate: 48000,
    channels: [
      new Float32Array([1, 0.5, 0, -0.5]),
      new Float32Array([0, 0.5, 0, 0.5]),
    ],
  };

  it("folds channels to mono and interleaves them", () => {
    expect(Array.from(toMono(stereo).channels[0]!)).toEqual([0.5, 0.5, 0, 0]);
    expect(Array.from(interleave(stereo))).toEqual([
      1, 0, 0.5, 0.5, 0, 0, -0.5, 0.5,
    ]);
    expect(durationOf(stereo)).toBeCloseTo(4 / 48000);
  });

  it("quantizes with clamping", () => {
    expect(quantize(0, 16)).toBe(0);
    expect(quantize(1, 16)).toBe(32767);
    expect(quantize(-1, 16)).toBe(-32768);
    expect(quantize(2, 16)).toBe(32767);
    expect(quantize(0.5, 24)).toBe(4194304);
  });

  it("resamples to another rate", () => {
    const ramp = new Float32Array(48000);
    for (let i = 0; i < ramp.length; i++) ramp[i] = i / ramp.length;
    const out = resample({ sampleRate: 48000, channels: [ramp] }, 16000);
    expect(out.sampleRate).toBe(16000);
    expect(out.channels[0]!.length).toBe(16000);
    expect(out.channels[0]![8000]).toBeCloseTo(0.5, 2);
    expect(resample(stereo, 48000)).toBe(stereo);
  });

  it("draws peaks in buckets", () => {
    const pcm: Pcm = {
      sampleRate: 8,
      channels: [new Float32Array([0.1, 0.9, 0.2, 0.3, -0.7, 0.1, 0, 0])],
    };
    expect(peaksOf(pcm, 4)).toEqual([0.9, 0.3, 0.7, 0]);
    expect(peaksOf(pcm, 0)).toEqual([]);
  });

  it("keeps a running thumbnail that halves rather than grows", () => {
    const running = new RunningPeaks(4, 2);
    running.push(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]));
    // Four buckets filled → halved to two of width four.
    expect(running.peaks()).toEqual([0.4, 0.8]);
    running.push(new Float32Array([0.9]));
    expect(running.peaks()).toEqual([0.4, 0.8, 0.9]);
  });
});

describe("wav", () => {
  const pcm: Pcm = {
    sampleRate: 44100,
    channels: [
      new Float32Array([0, 0.5, -0.5, 1]),
      new Float32Array([1, 0, 0, -1]),
    ],
  };

  it("writes a header a decoder reads back, at each depth", () => {
    for (const depth of [16, 24, 32] as const) {
      const bytes = encodeWav(pcm, depth);
      expect(bytes.length).toBe(44 + 4 * 2 * (depth / 8));
      const back = decodeWav(bytes);
      expect(back?.sampleRate).toBe(44100);
      expect(back?.channels).toHaveLength(2);
      const tolerance = depth === 32 ? 1e-7 : 2 / 2 ** (depth - 1);
      for (let c = 0; c < 2; c++) {
        for (let i = 0; i < 4; i++) {
          expect(
            Math.abs(back!.channels[c]![i]! - pcm.channels[c]![i]!),
          ).toBeLessThan(tolerance);
        }
      }
    }
  });

  it("refuses bytes that are not a WAV", () => {
    expect(decodeWav(new Uint8Array(10))).toBeNull();
    expect(
      decodeWav(
        new TextEncoder().encode(
          "RIFF....WAVXjunkjunkjunkjunkjunkjunkjunkjunkjunkjunk",
        ),
      ),
    ).toBeNull();
  });
});
