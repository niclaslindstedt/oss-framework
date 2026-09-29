// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The level meter's arithmetic: how loud a frame of samples is, in decibels
// relative to full scale, and whether it clipped.
//
// Everything here is a reading of one frame — a Float32Array of samples in
// the −1…1 range the Web Audio API hands out — and of the meter's own state
// from the frame before. Pure and clock-free: the frame's duration is a
// parameter, so a test can pin what the meter shows after exactly a second.
//
// Two figures per frame, because they answer different questions. The RMS is
// how loud the frame *sounds*, and is what the bar is filled to; the peak is
// the loudest single sample, and is what says whether the recording is about
// to be damaged. A microphone that clips is the one thing a voice memo cannot
// recover from afterwards, so the peak is held for a while and the clip lamp
// is latched rather than flickering for a frame.

/** The quietest reading the meter draws. Below this the bar is empty; a
 *  digital silence would otherwise be minus infinity. */
export const METER_FLOOR_DB = -60;

/** A sample this close to full scale is treated as clipped. Not 1.0 exactly:
 *  a converter that limits at −0.1 dBFS still flattens the wave, and an
 *  analyser's float output can land a hair under. */
export const CLIP_THRESHOLD = 0.985;

/** How many consecutive samples at the threshold make a clip. A single
 *  sample at full scale is a loud transient the converter caught; a run of
 *  them is a wave with its top cut off. */
export const CLIP_RUN = 3;

/** How long the clip lamp stays lit after the last clipped frame. */
export const CLIP_HOLD_MS = 1500;

/** How long the peak mark holds before it starts to fall. */
export const PEAK_HOLD_MS = 800;

/** How fast the peak mark falls once it lets go, in dB per second. */
export const PEAK_DECAY_DB_PER_S = 24;

/** How fast the bar itself falls, in dB per second — quicker than the peak
 *  mark, slower than the signal, so a word's end is a fall rather than a
 *  drop. It rises instantly. */
export const LEVEL_DECAY_DB_PER_S = 60;

/** The zones the bar is coloured in, from the top down: a reading at or
 *  above a zone's floor wears that zone's tone. The numbers are the ones a
 *  recording engineer keeps a voice inside: a healthy average around −18,
 *  peaks under −6, and anything above −3 a step from clipping. */
export const METER_ZONES = [
  { floorDb: -3, tone: "hot" },
  { floorDb: -6, tone: "loud" },
  { floorDb: -18, tone: "good" },
  { floorDb: METER_FLOOR_DB, tone: "quiet" },
] as const;

export type MeterTone = (typeof METER_ZONES)[number]["tone"];

/** A sample amplitude (0…1) as dBFS, floored so silence is drawable. */
export function toDb(amplitude: number): number {
  if (!(amplitude > 0)) return METER_FLOOR_DB;
  return Math.max(METER_FLOOR_DB, 20 * Math.log10(amplitude));
}

/** dBFS back to a share of the bar's length, 0 at the floor and 1 at full
 *  scale. What the meter is *drawn* from. */
export function meterFill(db: number): number {
  const clamped = Math.min(0, Math.max(METER_FLOOR_DB, db));
  return (clamped - METER_FLOOR_DB) / -METER_FLOOR_DB;
}

/** Which zone a reading falls in. */
export function meterTone(db: number): MeterTone {
  for (const zone of METER_ZONES) {
    if (db >= zone.floorDb) return zone.tone;
  }
  return "quiet";
}

/** What one frame of samples says on its own. */
export type FrameReading = {
  /** The frame's loudness, dBFS. */
  rmsDb: number;
  /** The loudest sample, dBFS. */
  peakDb: number;
  /** A run of samples at full scale was found in the frame. */
  clipped: boolean;
};

/** Read one frame. `samples` is what an analyser's time-domain output or a
 *  worklet's buffer holds: floats in −1…1. */
export function readFrame(samples: Float32Array): FrameReading {
  let sum = 0;
  let peak = 0;
  let run = 0;
  let clipped = false;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    const a = s < 0 ? -s : s;
    sum += s * s;
    if (a > peak) peak = a;
    if (a >= CLIP_THRESHOLD) {
      run += 1;
      if (run >= CLIP_RUN) clipped = true;
    } else {
      run = 0;
    }
  }
  const rms = samples.length ? Math.sqrt(sum / samples.length) : 0;
  return { rmsDb: toDb(rms), peakDb: toDb(peak), clipped };
}

/** The meter as it is drawn: the bar's level, the held peak, and the lamp. */
export type MeterState = {
  /** What the bar is filled to, dBFS: the signal on the way up, a slower
   *  fall on the way down. */
  levelDb: number;
  /** The peak mark, dBFS, held and then falling. */
  peakDb: number;
  /** How long the peak has been held, ms. */
  peakHeldMs: number;
  /** Whether the clip lamp is lit. */
  clipping: boolean;
  /** How long ago the last clip was, ms — `Infinity` if never. */
  sinceClipMs: number;
  /** How many clipped frames the recording has had. */
  clipCount: number;
  /** The loudest peak the recording has had, dBFS. */
  maxPeakDb: number;
};

export const METER_REST: MeterState = {
  levelDb: METER_FLOOR_DB,
  peakDb: METER_FLOOR_DB,
  peakHeldMs: 0,
  clipping: false,
  sinceClipMs: Infinity,
  clipCount: 0,
  maxPeakDb: METER_FLOOR_DB,
};

/** Advance the meter by one frame that took `dtMs`. */
export function stepMeter(
  prev: MeterState,
  frame: FrameReading,
  dtMs: number,
): MeterState {
  const dt = Math.max(0, dtMs);
  const seconds = dt / 1000;

  // The bar: up at once, down on a slope.
  const fallen = prev.levelDb - LEVEL_DECAY_DB_PER_S * seconds;
  const levelDb = Math.max(frame.rmsDb, fallen, METER_FLOOR_DB);

  // The peak mark: a new peak restarts the hold; an old one waits, then
  // slides down.
  let peakDb: number;
  let peakHeldMs: number;
  if (frame.peakDb >= prev.peakDb) {
    peakDb = frame.peakDb;
    peakHeldMs = 0;
  } else {
    peakHeldMs = prev.peakHeldMs + dt;
    const past = Math.max(0, peakHeldMs - PEAK_HOLD_MS) / 1000;
    peakDb = Math.max(
      frame.peakDb,
      prev.peakDb - PEAK_DECAY_DB_PER_S * past,
      METER_FLOOR_DB,
    );
    if (past > 0) peakHeldMs = PEAK_HOLD_MS + past * 1000;
  }

  const sinceClipMs = frame.clipped ? 0 : prev.sinceClipMs + dt;
  return {
    levelDb,
    peakDb,
    peakHeldMs,
    clipping: sinceClipMs < CLIP_HOLD_MS,
    sinceClipMs,
    clipCount: prev.clipCount + (frame.clipped ? 1 : 0),
    maxPeakDb: Math.max(prev.maxPeakDb, frame.peakDb),
  };
}

/** A reading in words for the rim of the meter: "−12.4 dB", or "−∞" at the
 *  floor. Formatted here rather than in the screen so the two meters — the
 *  recorder's and the player's — print the same. */
export function formatDb(db: number): string {
  if (db <= METER_FLOOR_DB) return "−∞";
  const rounded = Math.round(db * 10) / 10;
  const text = Math.abs(rounded).toFixed(1);
  return rounded < 0 ? `−${text}` : rounded > 0 ? `+${text}` : text;
}
