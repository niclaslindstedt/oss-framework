// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WAV file: the RIFF container around raw PCM, the one format every
// program that has ever opened a sound file can read. Pure — bytes out.

import { frameCount, interleave, quantize, type Pcm } from "./pcm.ts";

/** The bit depths a WAV export offers. 16 is what a CD is; 24 is what a
 *  studio keeps; 32 is the float the recording was decoded to, untouched. */
export const WAV_DEPTHS = [16, 24, 32] as const;
export type WavDepth = (typeof WAV_DEPTHS)[number];

export const DEFAULT_WAV_DEPTH: WavDepth = 16;

export function clampWavDepth(value: unknown): WavDepth {
  const n = Number(value);
  return (WAV_DEPTHS as readonly number[]).includes(n)
    ? (n as WavDepth)
    : DEFAULT_WAV_DEPTH;
}

export const MIME_WAV = "audio/wav";

/** Encode a recording as WAV. 16 and 24 bits are integer PCM (format 1);
 *  32 is IEEE float (format 3). */
export function encodeWav(
  pcm: Pcm,
  depth: WavDepth = DEFAULT_WAV_DEPTH,
): Uint8Array {
  const channels = Math.max(1, pcm.channels.length);
  const frames = frameCount(pcm);
  const bytesPerSample = depth / 8;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, depth === 32 ? 3 : 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, pcm.sampleRate, true);
  view.setUint32(28, pcm.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, depth, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  const samples = interleave(pcm);
  let at = 44;
  if (depth === 32) {
    for (let i = 0; i < samples.length; i++) {
      view.setFloat32(at, samples[i] ?? 0, true);
      at += 4;
    }
  } else if (depth === 16) {
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(at, quantize(samples[i] ?? 0, 16), true);
      at += 2;
    }
  } else {
    for (let i = 0; i < samples.length; i++) {
      const v = quantize(samples[i] ?? 0, 24);
      view.setUint8(at, v & 0xff);
      view.setUint8(at + 1, (v >> 8) & 0xff);
      view.setUint8(at + 2, (v >> 16) & 0xff);
      at += 3;
    }
  }
  return new Uint8Array(buffer);
}

/** Read a WAV's header back: what the tests check an export by, and what
 *  a lossless recording is opened with when the browser cannot decode it
 *  itself. Integer PCM and float only; anything else is `null`. */
export function decodeWav(bytes: Uint8Array): Pcm | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) =>
    String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let at = 12;
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let depth = 0;
  while (at + 8 <= bytes.length) {
    const id = tag(at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      depth = view.getUint16(body + 14, true);
    } else if (id === "data") {
      if (!channels || !sampleRate || !depth) return null;
      const end = Math.min(bytes.length, body + size);
      const bytesPer = depth / 8;
      const frames = Math.floor((end - body) / (bytesPer * channels));
      const out = Array.from(
        { length: channels },
        () => new Float32Array(frames),
      );
      let p = body;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          let v: number;
          if (format === 3 && depth === 32) v = view.getFloat32(p, true);
          else if (depth === 16) v = view.getInt16(p, true) / 32768;
          else if (depth === 24) {
            const raw =
              (bytes[p] ?? 0) |
              ((bytes[p + 1] ?? 0) << 8) |
              ((bytes[p + 2] ?? 0) << 16);
            v = ((raw << 8) >> 8) / 8388608;
          } else if (depth === 8) v = ((bytes[p] ?? 128) - 128) / 128;
          else return null;
          const ch = out[c];
          if (ch) ch[i] = v;
          p += bytesPer;
        }
      }
      return { sampleRate, channels: out };
    }
    at = body + size + (size & 1);
  }
  return null;
}
