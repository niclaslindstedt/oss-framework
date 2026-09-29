// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  crc16,
  crc8,
  encodeFlac,
  fixedResidual,
  utf8Number,
} from "../src/audio/flac.ts";
import { quantize, type Pcm } from "../src/audio/pcm.ts";

// A decoder for the subset the encoder writes, so the round trip is proved
// by reading the bytes back rather than by inspecting them: fixed-size
// frames, independent channels, CONSTANT / VERBATIM / FIXED subframes and
// Rice residuals with 4-bit parameters.

class BitReader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get bytePosition(): number {
    return this.at >> 3;
  }
  read(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const byte = this.bytes[this.at >> 3] ?? 0;
      const bit = (byte >> (7 - (this.at & 7))) & 1;
      value = value * 2 + bit;
      this.at++;
    }
    return value;
  }
  readSigned(width: number): number {
    const v = this.read(width);
    return v >= 2 ** (width - 1) ? v - 2 ** width : v;
  }
  readUnary(): number {
    let n = 0;
    while (this.read(1) === 0) n++;
    return n;
  }
  align(): void {
    this.at = (this.at + 7) & ~7;
  }
  seek(byte: number): void {
    this.at = byte * 8;
  }
}

function readUtf8Number(r: BitReader): number {
  const first = r.read(8);
  if (first < 0x80) return first;
  let count = 0;
  let mask = 0x80;
  while (first & mask) {
    count++;
    mask >>= 1;
  }
  let value = first & (mask - 1);
  for (let i = 1; i < count; i++) value = value * 64 + (r.read(8) & 0x3f);
  return value;
}

type Decoded = {
  sampleRate: number;
  channels: number;
  depth: number;
  total: number;
  samples: Int32Array[];
};

function decodeFlac(bytes: Uint8Array): Decoded {
  const r = new BitReader(bytes);
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("fLaC");
  r.seek(4);
  // Metadata blocks.
  let last = false;
  let info: {
    sampleRate: number;
    channels: number;
    depth: number;
    total: number;
  } | null = null;
  while (!last) {
    last = r.read(1) === 1;
    const type = r.read(7);
    const length = r.read(24);
    const start = r.bytePosition;
    if (type === 0) {
      r.read(16);
      r.read(16);
      r.read(24);
      r.read(24);
      const sampleRate = r.read(20);
      const channels = r.read(3) + 1;
      const depth = r.read(5) + 1;
      const total = r.read(36);
      info = { sampleRate, channels, depth, total };
    }
    r.seek(start + length);
  }
  if (!info) throw new Error("no STREAMINFO");
  const samples = Array.from(
    { length: info.channels },
    () => new Int32Array(info!.total),
  );
  let written = 0;
  while (written < info.total) {
    const frameStart = r.bytePosition;
    expect(r.read(14)).toBe(0b11111111111110);
    r.read(1);
    r.read(1);
    const blockCode = r.read(4);
    const rateCode = r.read(4);
    const chanCode = r.read(4);
    const sizeCode = r.read(3);
    r.read(1);
    readUtf8Number(r);
    let n: number;
    if (blockCode === 0b0110) n = r.read(8) + 1;
    else if (blockCode === 0b0111) n = r.read(16) + 1;
    else throw new Error("unexpected block size code");
    if (rateCode === 0b1100) r.read(8);
    else if (rateCode === 0b1101 || rateCode === 0b1110) r.read(16);
    const headerEnd = r.bytePosition;
    const headerCrc = r.read(8);
    expect(headerCrc).toBe(crc8(bytes.subarray(frameStart, headerEnd)));
    expect(chanCode).toBe(info.channels - 1);
    const depth = { 1: 8, 2: 12, 4: 16, 5: 20, 6: 24 }[sizeCode] ?? info.depth;
    for (let c = 0; c < info.channels; c++) {
      const out = samples[c]!;
      r.read(1);
      const type = r.read(6);
      const wasted = r.read(1);
      expect(wasted).toBe(0);
      if (type === 0) {
        const v = r.readSigned(depth);
        for (let i = 0; i < n; i++) out[written + i] = v;
      } else if (type === 1) {
        for (let i = 0; i < n; i++) out[written + i] = r.readSigned(depth);
      } else if ((type & 0b111000) === 0b001000) {
        const order = type & 0b111;
        const warm: number[] = [];
        for (let i = 0; i < order; i++) warm.push(r.readSigned(depth));
        expect(r.read(2)).toBe(0);
        const partitionOrder = r.read(4);
        const partitions = 1 << partitionOrder;
        const per = n / partitions;
        const residual: number[] = [];
        for (let p = 0; p < partitions; p++) {
          const k = r.read(4);
          expect(k).toBeLessThan(15);
          const count = p === 0 ? per - order : per;
          for (let i = 0; i < count; i++) {
            const q = r.readUnary();
            const low = k > 0 ? r.read(k) : 0;
            const u = q * 2 ** k + low;
            residual.push(u & 1 ? -(u + 1) / 2 : u / 2);
          }
        }
        const block = new Int32Array(n);
        for (let i = 0; i < order; i++) block[i] = warm[i] ?? 0;
        for (let i = order; i < n; i++) {
          const x1 = block[i - 1] ?? 0;
          const x2 = block[i - 2] ?? 0;
          const x3 = block[i - 3] ?? 0;
          const x4 = block[i - 4] ?? 0;
          const res = residual[i - order] ?? 0;
          let predicted = 0;
          if (order === 1) predicted = x1;
          else if (order === 2) predicted = 2 * x1 - x2;
          else if (order === 3) predicted = 3 * x1 - 3 * x2 + x3;
          else if (order === 4) predicted = 4 * x1 - 6 * x2 + 4 * x3 - x4;
          block[i] = predicted + res;
        }
        out.set(block, written);
      } else {
        throw new Error(`unexpected subframe type ${type}`);
      }
    }
    r.align();
    const frameEnd = r.bytePosition;
    const frameCrc = r.read(16);
    expect(frameCrc).toBe(crc16(bytes.subarray(frameStart, frameEnd)));
    written += n;
  }
  return { ...info, samples };
}

function tone(
  seconds: number,
  sampleRate: number,
  hz: number,
  gain = 0.5,
): Float32Array {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = gain * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  return out;
}

function noise(n: number, seed = 1): Float32Array {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return out;
}

function expectLossless(pcm: Pcm, depth: 16 | 24, bytes: Uint8Array) {
  const decoded = decodeFlac(bytes);
  expect(decoded.sampleRate).toBe(pcm.sampleRate);
  expect(decoded.channels).toBe(pcm.channels.length);
  expect(decoded.depth).toBe(depth);
  expect(decoded.total).toBe(pcm.channels[0]!.length);
  for (let c = 0; c < pcm.channels.length; c++) {
    const source = pcm.channels[c]!;
    const back = decoded.samples[c]!;
    for (let i = 0; i < source.length; i++) {
      if (back[i] !== quantize(source[i]!, depth)) {
        throw new Error(
          `channel ${c} sample ${i}: ${back[i]} != ${quantize(source[i]!, depth)}`,
        );
      }
    }
  }
}

describe("the FLAC encoder", () => {
  it("round-trips a mono tone at every level", () => {
    const pcm: Pcm = { sampleRate: 44100, channels: [tone(0.5, 44100, 440)] };
    for (const level of [0, 5, 8] as const) {
      expectLossless(pcm, 16, encodeFlac(pcm, { level }));
    }
  });

  it("round-trips stereo at 24 bits, at 48 kHz, across a partial last block", () => {
    const pcm: Pcm = {
      sampleRate: 48000,
      channels: [tone(0.3, 48000, 220, 0.8), noise(Math.round(0.3 * 48000))],
    };
    expectLossless(pcm, 24, encodeFlac(pcm, { depth: 24, level: 8 }));
  });

  it("writes an odd sample rate with the 16-bit field", () => {
    const pcm: Pcm = { sampleRate: 22222, channels: [tone(0.1, 22222, 300)] };
    expectLossless(pcm, 16, encodeFlac(pcm));
  });

  it("codes silence as constant subframes, and noise as verbatim or better", () => {
    const silence: Pcm = {
      sampleRate: 44100,
      channels: [new Float32Array(8192)],
    };
    const quiet = encodeFlac(silence);
    expectLossless(silence, 16, quiet);
    // Two frames of constant silence: a handful of bytes each past the header.
    expect(quiet.length).toBeLessThan(120);

    const loud: Pcm = { sampleRate: 44100, channels: [noise(8192)] };
    const raw = encodeFlac(loud);
    expectLossless(loud, 16, raw);
    expect(raw.length).toBeLessThanOrEqual(8192 * 2 + 200);
  });

  it("compresses a tone well below its raw size", () => {
    const pcm: Pcm = { sampleRate: 44100, channels: [tone(1, 44100, 440)] };
    const bytes = encodeFlac(pcm, { level: 8 });
    expect(bytes.length).toBeLessThan(44100 * 2 * 0.5);
  });

  it("handles an empty recording", () => {
    const bytes = encodeFlac({
      sampleRate: 44100,
      channels: [new Float32Array(0)],
    });
    const decoded = decodeFlac(bytes);
    expect(decoded.total).toBe(0);
  });

  it("agrees with the known CRC values", () => {
    const text = new TextEncoder().encode("123456789");
    expect(crc8(text)).toBe(0xf4);
    expect(crc16(text)).toBe(0xfee8);
  });

  it("writes the frame number as extended UTF-8", () => {
    expect(utf8Number(0)).toEqual([0]);
    expect(utf8Number(127)).toEqual([127]);
    expect(utf8Number(128)).toEqual([0xc2, 0x80]);
    expect(utf8Number(0x7ff)).toEqual([0xdf, 0xbf]);
    expect(utf8Number(0x800)).toEqual([0xe0, 0xa0, 0x80]);
    expect(utf8Number(0xffff)).toEqual([0xef, 0xbf, 0xbf]);
    expect(utf8Number(0x10000)).toEqual([0xf0, 0x90, 0x80, 0x80]);
  });

  it("leaves the right residual for each fixed order", () => {
    const s = new Int32Array([1, 4, 9, 16, 25, 36]);
    expect(Array.from(fixedResidual(s, 0))).toEqual([1, 4, 9, 16, 25, 36]);
    expect(Array.from(fixedResidual(s, 1))).toEqual([3, 5, 7, 9, 11]);
    expect(Array.from(fixedResidual(s, 2))).toEqual([2, 2, 2, 2]);
    expect(Array.from(fixedResidual(s, 3))).toEqual([0, 0, 0]);
  });
});
