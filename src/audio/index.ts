// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public audio surface, available under the "@niclaslindstedt/oss-framework/audio"
// subpath: the arithmetic behind a level meter and a spectrum analyser, PCM
// tools, lossless encoders (WAV, FLAC), decoding through the browser, a
// microphone capture with a recorder hook over it, a player hook, and the
// three components — the meter, the spectrum and the waveform.
//
// The MP3 encoder is its own entry, "…/audio/mp3", because it rides an
// optional peer package.

export {
  CLIP_HOLD_MS,
  CLIP_RUN,
  CLIP_THRESHOLD,
  LEVEL_DECAY_DB_PER_S,
  METER_FLOOR_DB,
  METER_REST,
  METER_ZONES,
  PEAK_DECAY_DB_PER_S,
  PEAK_HOLD_MS,
  formatDb,
  meterFill,
  meterTone,
  readFrame,
  stepMeter,
  toDb,
  type FrameReading,
  type MeterState,
  type MeterTone,
} from "./levels.ts";
export {
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
  bandLevels,
  bandTicks,
  layoutBands,
  smoothBands,
  type BandLayout,
} from "./spectrum.ts";
export {
  RunningPeaks,
  durationOf,
  frameCount,
  interleave,
  peaksOf,
  quantize,
  quantizeChannel,
  resample,
  toMono,
  type Pcm,
} from "./pcm.ts";
export {
  DEFAULT_WAV_DEPTH,
  MIME_WAV,
  WAV_DEPTHS,
  clampWavDepth,
  decodeWav,
  encodeWav,
  type WavDepth,
} from "./wav.ts";
export {
  DEFAULT_FLAC_DEPTH,
  DEFAULT_FLAC_LEVEL,
  FLAC_DEPTHS,
  FLAC_LEVELS,
  MIME_FLAC,
  clampFlacDepth,
  clampFlacLevel,
  encodeFlac,
  type FlacDepth,
  type FlacLevel,
  type FlacOptions,
} from "./flac.ts";
export { decodeAudio, pcmFromAudioBuffer } from "./decode.ts";
export {
  Capture,
  RECORDING_MIMES,
  extensionForMime,
  pickRecordingMime,
  type CaptureFrame,
  type CaptureMode,
  type CaptureOptions,
  type CaptureResult,
  type CaptureState,
} from "./capture.ts";
export {
  classifyRecorderError,
  useRecorder,
  type Recorder,
  type RecorderError,
} from "./useRecorder.ts";
export { PLAYBACK_RATES, usePlayer, type Player } from "./usePlayer.ts";
export {
  LevelMeter,
  METER_SCALE_DB,
  type LevelMeterLabels,
  type LevelMeterProps,
} from "./LevelMeter.tsx";
export { SpectrumBars, type SpectrumBarsProps } from "./SpectrumBars.tsx";
export { Waveform, type WaveformProps } from "./Waveform.tsx";
