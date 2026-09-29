// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// An MP3 encoder over the `@breezystack/lamejs` package — an optional peer,
// reached only through this entry so that no other import in the library
// resolves it (see `theme/fontsource.ts` for the same arrangement).
//
//   import { encodeMp3 } from "@niclaslindstedt/oss-framework/audio/mp3";
//
// The package is a port of LAME and is not small; import this module lazily,
// from the export action, so the bytes are fetched when a file is asked for
// and not on first paint. Pure: samples in, bytes out.

import { Mp3Encoder } from "@breezystack/lamejs";

import { frameCount, quantizeChannel, type Pcm } from "./pcm.ts";

/** The bitrates offered, kbit/s. 96 is plenty for a voice; 320 is the top
 *  the format has. */
export const MP3_BITRATES = [64, 96, 128, 192, 256, 320] as const;
export type Mp3Bitrate = (typeof MP3_BITRATES)[number];

export const DEFAULT_MP3_BITRATE: Mp3Bitrate = 128;

export const MIME_MP3 = "audio/mpeg";

export function clampMp3Bitrate(value: unknown): Mp3Bitrate {
  const n = Number(value);
  return (MP3_BITRATES as readonly number[]).includes(n)
    ? (n as Mp3Bitrate)
    : DEFAULT_MP3_BITRATE;
}

/** The sample rates the encoder accepts. A recording at another rate is
 *  resampled to the nearest one first (`resample` in `pcm.ts`). */
export const MP3_SAMPLE_RATES = [
  8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
] as const;

export function nearestMp3SampleRate(sampleRate: number): number {
  let best: number = MP3_SAMPLE_RATES[0];
  for (const rate of MP3_SAMPLE_RATES) {
    if (Math.abs(rate - sampleRate) < Math.abs(best - sampleRate)) best = rate;
  }
  return best;
}

const CHUNK = 1152 * 8;

/** Encode a recording as MP3 at a constant bitrate. Mono or stereo; a
 *  recording with more channels is encoded from its first two. */
export function encodeMp3(
  pcm: Pcm,
  bitrate: Mp3Bitrate = DEFAULT_MP3_BITRATE,
): Uint8Array {
  const channels = Math.min(2, Math.max(1, pcm.channels.length));
  const encoder = new Mp3Encoder(channels, pcm.sampleRate, bitrate);
  const left = new Int16Array(
    quantizeChannel(pcm.channels[0] ?? new Float32Array(0), 16),
  );
  const right =
    channels === 2
      ? new Int16Array(
          quantizeChannel(pcm.channels[1] ?? new Float32Array(0), 16),
        )
      : null;
  const n = frameCount(pcm);
  const parts: Uint8Array[] = [];
  for (let at = 0; at < n; at += CHUNK) {
    const l = left.subarray(at, at + CHUNK);
    const part = right
      ? encoder.encodeBuffer(l, right.subarray(at, at + CHUNK))
      : encoder.encodeBuffer(l);
    if (part.length > 0) parts.push(new Uint8Array(part));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(new Uint8Array(tail));
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
