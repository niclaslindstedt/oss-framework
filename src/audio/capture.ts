// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The microphone, as one object: open it, watch it, keep what it hears.
//
// A capture opens the device with `getUserMedia`, hangs an `AnalyserNode` on
// it for the spectrum, taps every sample through an `AudioWorklet` (or the
// older `ScriptProcessorNode` where there is none) for the level meter, the
// clip lamp, the running waveform thumbnail and the elapsed time — and keeps
// the recording one of two ways:
//
//   • `encoded` — a `MediaRecorder` in whatever container the browser
//     offers (Opus in WebM, AAC in MP4). Small files, the browser's own
//     encoder, and `stop()` hands back a `Blob`.
//   • `pcm` — the tapped samples themselves, collected into a {@link Pcm}
//     so the caller can encode them losslessly (`encodeFlac`, `encodeWav`).
//
// Every reading the screen draws arrives through `subscribe`, once per
// animation frame, off React's render loop: a meter that re-rendered a tree
// sixty times a second would be the wrong shape. `useRecorder` is the hook
// over this; the components take a capture's `subscribe` directly.
//
// Nothing here is stored or sent anywhere. The device is released on `stop`
// and on `cancel`.

import { METER_REST, readFrame, stepMeter, type MeterState } from "./levels.ts";
import { RunningPeaks, type Pcm } from "./pcm.ts";
import { bandLevels, layoutBands, smoothBands } from "./spectrum.ts";

export type CaptureMode = "encoded" | "pcm";

export type CaptureOptions = {
  /** How the recording is kept. Defaults to `encoded`. */
  mode?: CaptureMode;
  /** The container to ask the browser's encoder for, in order of preference;
   *  the first it supports is used. Defaults to {@link RECORDING_MIMES}. */
  mimeTypes?: readonly string[];
  /** The encoder's target bitrate, bits per second. */
  bitsPerSecond?: number;
  /** Whether to ask the device for its voice processing — echo cancelling,
   *  noise suppression, automatic gain. Off records what the microphone
   *  hears; on is what a call sounds like. Defaults to off. */
  processing?: boolean;
  /** A particular input, from `enumerateDevices`. */
  deviceId?: string;
  /** The analyser's FFT size (a power of two) and how many bars the
   *  spectrum is folded into. */
  fftSize?: number;
  bands?: number;
  /** How many buckets the running waveform thumbnail keeps. */
  thumbnail?: number;
};

/** The containers tried, in order: Opus where the browser has it, the AAC
 *  in MP4 that WebKit offers, then whatever else answers. */
export const RECORDING_MIMES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
];

/** The first container the browser's encoder supports, or `""` for its
 *  default. `isSupported` is `MediaRecorder.isTypeSupported`, handed in so
 *  the choice can be tested without one. */
export function pickRecordingMime(
  candidates: readonly string[] = RECORDING_MIMES,
  isSupported: (mime: string) => boolean = (mime) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime),
): string {
  for (const mime of candidates) {
    try {
      if (isSupported(mime)) return mime;
    } catch {
      // A browser without the method: fall through to the default.
    }
  }
  return "";
}

/** The file extension a container is saved under. */
export function extensionForMime(mime: string): string {
  const type = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  switch (type) {
    case "audio/webm":
    case "video/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
    case "audio/x-m4a":
    case "audio/m4a":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
    case "audio/wave":
      return "wav";
    case "audio/flac":
    case "audio/x-flac":
      return "flac";
    default:
      return "bin";
  }
}

/** One frame's readings, handed to every subscriber. The arrays are reused
 *  between frames: copy them if they are kept. */
export type CaptureFrame = {
  meter: MeterState;
  /** The spectrum, 0…1 per bar. */
  bands: Float32Array;
  /** The waveform thumbnail so far. */
  peaks: number[];
  /** Recorded time, paused stretches left out. */
  elapsedMs: number;
  /** The frame's own samples — for a scrolling waveform that wants them. */
  samples: Float32Array;
};

export type CaptureState =
  "idle" | "starting" | "recording" | "paused" | "stopping" | "done";

/** What `stop` hands back. */
export type CaptureResult = {
  mode: CaptureMode;
  /** The container, `encoded` mode. Empty in `pcm` mode. */
  blob: Blob;
  /** The blob's type: what the encoder chose, or `""` when unknown. */
  mimeType: string;
  /** The samples, `pcm` mode. `null` in `encoded` mode. */
  pcm: Pcm | null;
  durationMs: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
  clipCount: number;
  maxPeakDb: number;
};

/** The worklet that taps the input: it copies each block of channel data
 *  and posts a batch every `BATCH` frames, so the main thread sees every
 *  sample without a message per 128 of them. Written as a string, so it is
 *  loaded from a blob URL and the library ships no asset. */
const TAP_BATCH = 2048;
const TAP_WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.filled = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channels = input.length;
    if (this.buffers.length !== channels) {
      this.buffers = [];
      for (let c = 0; c < channels; c++) this.buffers.push(new Float32Array(${TAP_BATCH}));
      this.filled = 0;
    }
    const frames = input[0].length;
    for (let c = 0; c < channels; c++) this.buffers[c].set(input[c], this.filled);
    this.filled += frames;
    if (this.filled >= ${TAP_BATCH}) {
      const out = this.buffers.map((b) => b.slice(0, this.filled));
      this.port.postMessage(out, out.map((b) => b.buffer));
      this.buffers = [];
      for (let c = 0; c < channels; c++) this.buffers.push(new Float32Array(${TAP_BATCH}));
      this.filled = 0;
    }
    return true;
  }
}
registerProcessor("oss-tap", Tap);
`;

type ContextCtor = typeof AudioContext;

function contextCtor(): ContextCtor | null {
  const g = globalThis as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class Capture {
  readonly mode: CaptureMode;
  private readonly options: CaptureOptions;
  private listeners = new Set<(frame: CaptureFrame) => void>();
  private stateValue: CaptureState = "idle";
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private tap: AudioNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private pcmChunks: Float32Array[][] = [];
  private samplesSeen = 0;
  private channelCount = 1;
  private meter: MeterState = METER_REST;
  private peaks: RunningPeaks | null = null;
  private bands: Float32Array;
  private freq: Float32Array<ArrayBuffer> | null = null;
  private layout: ReturnType<typeof layoutBands> | null = null;
  private lastFrame: Float32Array = new Float32Array(0);
  private lastTick = 0;
  private lastTapAt = 0;
  private raf = 0;
  private stopped: Promise<CaptureResult> | null = null;

  constructor(options: CaptureOptions = {}) {
    this.options = options;
    this.mode = options.mode ?? "encoded";
    this.bands = new Float32Array(options.bands ?? 32);
  }

  get state(): CaptureState {
    return this.stateValue;
  }

  /** The device's rate, once open. */
  get sampleRate(): number {
    return this.context?.sampleRate ?? 0;
  }

  get elapsedMs(): number {
    return this.sampleRate > 0
      ? (this.samplesSeen / this.sampleRate) * 1000
      : 0;
  }

  /** The container the encoder settled on, `encoded` mode. */
  get mimeType(): string {
    return this.recorder?.mimeType ?? "";
  }

  subscribe(listener: (frame: CaptureFrame) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Open the microphone and begin. Rejects where the device is refused or
   *  absent — the error is the browser's (`NotAllowedError`,
   *  `NotFoundError`) so the caller can say which. */
  async start(): Promise<void> {
    if (this.stateValue !== "idle") throw new Error("already started");
    this.stateValue = "starting";
    const Ctor = contextCtor();
    if (
      !Ctor ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      this.stateValue = "idle";
      throw new DOMException(
        "Recording is not available here.",
        "NotSupportedError",
      );
    }
    const processing = this.options.processing ?? false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: processing,
          noiseSuppression: processing,
          autoGainControl: processing,
          ...(this.options.deviceId
            ? { deviceId: { exact: this.options.deviceId } }
            : {}),
        },
      });
    } catch (err) {
      this.stateValue = "idle";
      throw err;
    }
    const context = new Ctor({ latencyHint: "interactive" });
    this.context = context;
    if (context.state === "suspended") await context.resume().catch(() => {});
    const source = context.createMediaStreamSource(this.stream);
    this.channelCount = Math.max(1, source.channelCount || 1);

    const analyser = context.createAnalyser();
    analyser.fftSize = this.options.fftSize ?? 2048;
    analyser.smoothingTimeConstant = 0.6;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    source.connect(analyser);
    this.analyser = analyser;
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.layout = layoutBands(
      this.bands.length,
      analyser.fftSize,
      context.sampleRate,
    );

    this.peaks = new RunningPeaks(
      this.options.thumbnail ?? 200,
      Math.round(context.sampleRate / 20),
    );
    this.meter = METER_REST;
    this.samplesSeen = 0;
    this.pcmChunks = [];
    this.chunks = [];

    await this.installTap(context, source);

    if (this.mode === "encoded") {
      if (typeof MediaRecorder === "undefined") {
        await this.release();
        this.stateValue = "idle";
        throw new DOMException(
          "Recording is not available here.",
          "NotSupportedError",
        );
      }
      const mimeType = pickRecordingMime(this.options.mimeTypes);
      const recorder = new MediaRecorder(this.stream, {
        ...(mimeType ? { mimeType } : {}),
        ...(this.options.bitsPerSecond
          ? { audioBitsPerSecond: this.options.bitsPerSecond }
          : {}),
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder = recorder;
      recorder.start(1000);
    }

    this.stateValue = "recording";
    this.lastTick = now();
    this.loop();
  }

  pause(): void {
    if (this.stateValue !== "recording") return;
    this.recorder?.pause();
    this.stateValue = "paused";
  }

  resume(): void {
    if (this.stateValue !== "paused") return;
    this.recorder?.resume();
    this.stateValue = "recording";
    this.lastTick = now();
  }

  /** End the recording and release the device. Idempotent: a second call
   *  returns the same result. */
  stop(): Promise<CaptureResult> {
    if (this.stopped) return this.stopped;
    this.stopped = this.finish();
    return this.stopped;
  }

  /** Release the device and keep nothing. */
  async cancel(): Promise<void> {
    if (this.stateValue === "done" || this.stateValue === "idle") return;
    this.stateValue = "stopping";
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.ondataavailable = null;
        this.recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    await this.release();
    this.chunks = [];
    this.pcmChunks = [];
    this.stateValue = "done";
  }

  private async finish(): Promise<CaptureResult> {
    this.stateValue = "stopping";
    cancelAnimationFrame(this.raf);
    let blob = new Blob([]);
    let mimeType = "";
    if (this.recorder) {
      const recorder = this.recorder;
      mimeType = recorder.mimeType;
      if (recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          try {
            recorder.stop();
          } catch {
            resolve();
          }
        });
      }
      blob = new Blob(this.chunks, mimeType ? { type: mimeType } : undefined);
    }
    const sampleRate = this.sampleRate;
    const pcm = this.mode === "pcm" ? this.collectPcm(sampleRate) : null;
    await this.release();
    this.stateValue = "done";
    return {
      mode: this.mode,
      blob,
      mimeType,
      pcm,
      durationMs: sampleRate > 0 ? (this.samplesSeen / sampleRate) * 1000 : 0,
      sampleRate,
      channels: this.channelCount,
      peaks: this.peaks?.peaks() ?? [],
      clipCount: this.meter.clipCount,
      maxPeakDb: this.meter.maxPeakDb,
    };
  }

  private collectPcm(sampleRate: number): Pcm {
    const channels: Float32Array[] = [];
    for (let c = 0; c < this.channelCount; c++) {
      let total = 0;
      for (const chunk of this.pcmChunks) total += chunk[c]?.length ?? 0;
      const out = new Float32Array(total);
      let at = 0;
      for (const chunk of this.pcmChunks) {
        const part = chunk[c];
        if (!part) continue;
        out.set(part, at);
        at += part.length;
      }
      channels.push(out);
    }
    this.pcmChunks = [];
    return { sampleRate, channels };
  }

  private async installTap(
    context: AudioContext,
    source: AudioNode,
  ): Promise<void> {
    const onBatch = (batch: Float32Array[]) => this.onSamples(batch);
    if (context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      try {
        const url = URL.createObjectURL(
          new Blob([TAP_WORKLET], { type: "text/javascript" }),
        );
        try {
          await context.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        const node = new AudioWorkletNode(context, "oss-tap", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: this.channelCount,
        });
        node.port.onmessage = (e: MessageEvent<Float32Array[]>) =>
          onBatch(e.data);
        source.connect(node);
        this.tap = node;
        return;
      } catch {
        // Fall through to the script processor.
      }
    }
    const processor = context.createScriptProcessor(
      TAP_BATCH,
      this.channelCount,
      1,
    );
    processor.onaudioprocess = (e) => {
      const batch: Float32Array[] = [];
      for (let c = 0; c < e.inputBuffer.numberOfChannels; c++) {
        batch.push(new Float32Array(e.inputBuffer.getChannelData(c)));
      }
      onBatch(batch);
    };
    source.connect(processor);
    // A script processor only runs while connected to the graph's output;
    // its own output is silence (a single zeroed channel).
    processor.connect(context.destination);
    this.tap = processor;
  }

  /** A batch of samples off the tap: every sample the device heard. */
  private onSamples(batch: Float32Array[]): void {
    if (this.stateValue !== "recording") return;
    const first = batch[0];
    if (!first) return;
    const t = now();
    const dt = this.lastTapAt
      ? t - this.lastTapAt
      : (first.length / Math.max(1, this.sampleRate)) * 1000;
    this.lastTapAt = t;
    // The meter reads the loudest channel: a clip on either is a clip.
    let frame = readFrame(first);
    for (let c = 1; c < batch.length; c++) {
      const other = readFrame(batch[c] ?? first);
      if (other.peakDb > frame.peakDb || other.clipped) {
        frame = {
          rmsDb: Math.max(frame.rmsDb, other.rmsDb),
          peakDb: Math.max(frame.peakDb, other.peakDb),
          clipped: frame.clipped || other.clipped,
        };
      }
    }
    this.meter = stepMeter(this.meter, frame, dt);
    this.peaks?.push(first);
    this.samplesSeen += first.length;
    this.lastFrame = first;
    if (this.mode === "pcm") this.pcmChunks.push(batch);
  }

  private loop = (): void => {
    if (this.stateValue !== "recording" && this.stateValue !== "paused") return;
    const t = now();
    const dt = t - this.lastTick;
    this.lastTick = t;
    if (this.analyser && this.freq && this.layout) {
      if (this.stateValue === "recording") {
        this.analyser.getFloatFrequencyData(this.freq);
        const next = bandLevels(this.freq, this.layout);
        smoothBands(this.bands, next, dt);
      } else {
        smoothBands(this.bands, new Float32Array(this.bands.length), dt);
      }
    }
    if (this.stateValue === "paused") {
      // The meter falls while paused: the bar goes quiet, the lamp stays
      // for its hold, the peak lets go.
      this.meter = stepMeter(
        this.meter,
        { rmsDb: -Infinity, peakDb: -Infinity, clipped: false },
        dt,
      );
    }
    const frame: CaptureFrame = {
      meter: this.meter,
      bands: this.bands,
      peaks: this.peaks?.peaks() ?? [],
      elapsedMs: this.elapsedMs,
      samples: this.lastFrame,
    };
    for (const listener of this.listeners) {
      try {
        listener(frame);
      } catch {
        // One listener's failure is not another's.
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private async release(): Promise<void> {
    cancelAnimationFrame(this.raf);
    try {
      this.tap?.disconnect();
    } catch {
      // Already gone.
    }
    this.tap = null;
    this.analyser = null;
    this.recorder = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    const context = this.context;
    this.context = null;
    if (context) await context.close().catch(() => {});
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
