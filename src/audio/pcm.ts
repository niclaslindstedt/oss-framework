// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Samples as the encoders want them: a `Pcm` is the decoded recording — one
// Float32Array per channel, −1…1, at one sample rate — and this module is
// what turns it into another rate, another channel count, or integers.
//
// Pure. The decoding itself (a browser's `decodeAudioData`) is in
// `decode.ts`; nothing here touches the Web Audio API.

export type Pcm = {
  sampleRate: number;
  /** One array per channel, all the same length. */
  channels: Float32Array[];
};

/** How many samples a channel holds. */
export function frameCount(pcm: Pcm): number {
  return pcm.channels[0]?.length ?? 0;
}

/** The recording's length in seconds. */
export function durationOf(pcm: Pcm): number {
  return pcm.sampleRate > 0 ? frameCount(pcm) / pcm.sampleRate : 0;
}

/** Fold every channel into one. A voice memo is mono in all but name, and
 *  an export that halves the file for it loses nothing worth keeping. */
export function toMono(pcm: Pcm): Pcm {
  if (pcm.channels.length <= 1) return pcm;
  const n = frameCount(pcm);
  const out = new Float32Array(n);
  const share = 1 / pcm.channels.length;
  for (const ch of pcm.channels) {
    for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) + (ch[i] ?? 0) * share;
  }
  return { sampleRate: pcm.sampleRate, channels: [out] };
}

/** Resample by linear interpolation. Good enough for a voice — the
 *  interpolation's roll-off sits above a voice's harmonics — and small
 *  enough to read; a windowed-sinc resampler would be a module in its own
 *  right for a difference no memo would show. Downsampling first runs a
 *  gentle moving-average low-pass so the octaves above the new Nyquist do
 *  not fold back in as hiss. */
export function resample(pcm: Pcm, sampleRate: number): Pcm {
  if (sampleRate === pcm.sampleRate || !(sampleRate > 0)) return pcm;
  const ratio = pcm.sampleRate / sampleRate;
  const n = frameCount(pcm);
  const outLength = Math.max(0, Math.round(n / ratio));
  const channels = pcm.channels.map((input) => {
    const src = ratio > 1 ? lowPass(input, Math.ceil(ratio)) : input;
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio;
      const j = Math.floor(pos);
      const frac = pos - j;
      const a = src[j] ?? 0;
      const b = src[j + 1] ?? a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  });
  return { sampleRate, channels };
}

/** A moving average `width` samples wide — the cheapest low-pass there is. */
function lowPass(input: Float32Array, width: number): Float32Array {
  if (width <= 1) return input;
  const out = new Float32Array(input.length);
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input[i] ?? 0;
    if (i >= width) sum -= input[i - width] ?? 0;
    out[i] = sum / Math.min(width, i + 1);
  }
  return out;
}

/** A float sample as a signed integer of `bits` bits, clamped. */
export function quantize(sample: number, bits: number): number {
  const max = 2 ** (bits - 1) - 1;
  const min = -(2 ** (bits - 1));
  const scaled = Math.round(sample * (max + 1));
  return scaled > max ? max : scaled < min ? min : scaled;
}

/** One channel as integers of `bits` bits. */
export function quantizeChannel(
  channel: Float32Array,
  bits: number,
): Int32Array {
  const out = new Int32Array(channel.length);
  for (let i = 0; i < channel.length; i++)
    out[i] = quantize(channel[i] ?? 0, bits);
  return out;
}

/** Interleave channels sample by sample, as a WAV's data chunk and an MP3
 *  encoder's stereo input want them. */
export function interleave(pcm: Pcm): Float32Array {
  const n = frameCount(pcm);
  const c = pcm.channels.length;
  const out = new Float32Array(n * c);
  for (let ch = 0; ch < c; ch++) {
    const input = pcm.channels[ch] ?? new Float32Array(n);
    for (let i = 0; i < n; i++) out[i * c + ch] = input[i] ?? 0;
  }
  return out;
}

/** The peaks a waveform thumbnail is drawn from: `count` buckets across the
 *  recording, each the loudest sample in its stretch, 0…1. */
export function peaksOf(pcm: Pcm, count: number): number[] {
  const n = frameCount(pcm);
  const out: number[] = [];
  if (n === 0 || count <= 0) return out;
  const per = n / count;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(b * per);
    const end = Math.max(start + 1, Math.floor((b + 1) * per));
    let peak = 0;
    for (const ch of pcm.channels) {
      for (let i = start; i < end && i < n; i++) {
        const v = ch[i] ?? 0;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
    }
    out.push(Math.min(1, Math.round(peak * 1000) / 1000));
  }
  return out;
}

/** The peaks of a recording still going: fold every new frame of samples
 *  into a running list of buckets that never grows past `count`. When the
 *  list is full it halves — two buckets into one — so a long recording's
 *  thumbnail is coarser rather than longer. */
export class RunningPeaks {
  private buckets: number[] = [];
  private current = 0;
  private filled = 0;
  private per: number;

  constructor(
    private readonly count: number,
    initialPerBucket: number,
  ) {
    this.per = Math.max(1, initialPerBucket);
  }

  push(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] ?? 0;
      const a = v < 0 ? -v : v;
      if (a > this.current) this.current = a;
      this.filled += 1;
      if (this.filled >= this.per) this.close();
    }
  }

  private close(): void {
    this.buckets.push(Math.min(1, Math.round(this.current * 1000) / 1000));
    this.current = 0;
    this.filled = 0;
    if (this.buckets.length >= this.count) {
      const halved: number[] = [];
      for (let i = 0; i < this.buckets.length; i += 2) {
        halved.push(Math.max(this.buckets[i] ?? 0, this.buckets[i + 1] ?? 0));
      }
      this.buckets = halved;
      this.per *= 2;
    }
  }

  /** The thumbnail so far, the open bucket included. */
  peaks(): number[] {
    const out = this.buckets.slice();
    if (this.filled > 0)
      out.push(Math.min(1, Math.round(this.current * 1000) / 1000));
    return out;
  }
}
