// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FLAC encoder in plain TypeScript — lossless, dependency-free, and small
// enough to read. It writes the subset every decoder handles: fixed-size
// blocks, independent channels, FIXED predictors (orders 0–4) with Rice-coded
// residuals, and CONSTANT or VERBATIM subframes where those win.
//
// No LPC. The fixed predictors get within a few percent of what the reference
// encoder's LPC does on speech, and an LPC stage would be the larger half of
// this file for that few percent. The `level` is the search budget: how many
// predictor orders and Rice partition orders are tried per block.
//
// The stream's MD5 is left as zeros, which the format defines as "not
// computed". The CRCs a decoder actually checks — CRC-8 on each frame header
// and CRC-16 on each frame — are written.
//
// Pure: samples in, bytes out. See `tests/audio-flac.test.ts`, which decodes
// the output with a decoder of its own to prove the round trip.

import { frameCount, quantizeChannel, type Pcm } from "./pcm.ts";

/** The bit depths a FLAC export offers. */
export const FLAC_DEPTHS = [16, 24] as const;
export type FlacDepth = (typeof FLAC_DEPTHS)[number];

/** The search budgets: 0 encodes fast with the simplest residuals, 8 tries
 *  everything this encoder knows. Mirrors the reference encoder's scale so a
 *  setting reads the way one there does. */
export const FLAC_LEVELS = [0, 5, 8] as const;
export type FlacLevel = (typeof FLAC_LEVELS)[number];

export const DEFAULT_FLAC_LEVEL: FlacLevel = 5;
export const DEFAULT_FLAC_DEPTH: FlacDepth = 16;

export const MIME_FLAC = "audio/flac";

export function clampFlacLevel(value: unknown): FlacLevel {
  const n = Number(value);
  return (FLAC_LEVELS as readonly number[]).includes(n)
    ? (n as FlacLevel)
    : DEFAULT_FLAC_LEVEL;
}

export function clampFlacDepth(value: unknown): FlacDepth {
  const n = Number(value);
  return (FLAC_DEPTHS as readonly number[]).includes(n)
    ? (n as FlacDepth)
    : DEFAULT_FLAC_DEPTH;
}

export type FlacOptions = {
  depth?: FlacDepth;
  level?: FlacLevel;
  /** Samples per frame. 4096 is the reference encoder's default. */
  blockSize?: number;
};

const BLOCK_SIZE = 4096;

/** A growable bit writer, MSB first, as FLAC is laid out. */
class BitWriter {
  private bytes = new Uint8Array(1 << 16);
  private at = 0;
  private acc = 0;
  private bits = 0;

  write(value: number, width: number): void {
    // Wide values are written in two halves so the accumulator never holds
    // more than 32 bits.
    if (width > 24) {
      this.write(Math.floor(value / 2 ** 24), width - 24);
      this.write(value % 2 ** 24, 24);
      return;
    }
    this.acc = (this.acc << width) | (value & ((1 << width) - 1));
    this.bits += width;
    while (this.bits >= 8) {
      this.bits -= 8;
      this.push((this.acc >>> this.bits) & 0xff);
    }
    this.acc &= (1 << this.bits) - 1;
  }

  /** A signed value in two's complement of `width` bits. */
  writeSigned(value: number, width: number): void {
    this.write(value < 0 ? value + 2 ** width : value, width);
  }

  /** `count` zero bits then a one — FLAC's unary. */
  writeUnary(count: number): void {
    while (count >= 24) {
      this.write(0, 24);
      count -= 24;
    }
    this.write(1, count + 1);
  }

  align(): void {
    if (this.bits > 0) this.write(0, 8 - this.bits);
  }

  get length(): number {
    return this.at;
  }

  private push(byte: number): void {
    if (this.at >= this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.at++] = byte;
  }

  slice(from: number): Uint8Array {
    return this.bytes.subarray(from, this.at);
  }

  patch(at: number, byte: number): void {
    this.bytes[at] = byte;
  }

  finish(): Uint8Array {
    this.align();
    return this.bytes.slice(0, this.at);
  }
}

// --- CRCs --------------------------------------------------------------------

const CRC8_TABLE = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++)
      c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    table[i] = c;
  }
  return table;
})();

const CRC16_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let k = 0; k < 8; k++) {
      c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff;
    }
    table[i] = c;
  }
  return table;
})();

/** CRC-8, polynomial 0x07, initial 0 — the frame header's. */
export function crc8(bytes: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < bytes.length; i++)
    c = CRC8_TABLE[c ^ (bytes[i] ?? 0)] ?? 0;
  return c;
}

/** CRC-16, polynomial 0x8005, initial 0 — the whole frame's. */
export function crc16(bytes: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) {
    c =
      (((c << 8) & 0xffff) ^ (CRC16_TABLE[(c >> 8) ^ (bytes[i] ?? 0)] ?? 0)) &
      0xffff;
  }
  return c;
}

// --- the frame number ---------------------------------------------------------

/** The frame number in FLAC's extended UTF-8 — up to 36 bits in 7 bytes. */
export function utf8Number(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  let value = n;
  let count = 0;
  const limits = [0x800, 0x10000, 0x200000, 0x4000000, 0x80000000, 2 ** 36];
  for (let i = 0; i < limits.length; i++) {
    if (n < (limits[i] ?? Infinity)) {
      count = i + 2;
      break;
    }
  }
  if (count === 0) throw new Error("frame number too large");
  for (let i = 0; i < count - 1; i++) {
    bytes.unshift(0x80 | (value & 0x3f));
    value = Math.floor(value / 64);
  }
  const lead = (0xff << (8 - count)) & 0xff;
  bytes.unshift(lead | value);
  return bytes;
}

// --- the residual --------------------------------------------------------------

/** The residual a FIXED predictor of `order` leaves, from `order` onwards. */
export function fixedResidual(samples: Int32Array, order: number): Int32Array {
  const n = samples.length;
  const out = new Int32Array(Math.max(0, n - order));
  for (let i = order; i < n; i++) {
    const x0 = samples[i] ?? 0;
    const x1 = samples[i - 1] ?? 0;
    const x2 = samples[i - 2] ?? 0;
    const x3 = samples[i - 3] ?? 0;
    const x4 = samples[i - 4] ?? 0;
    let r: number;
    switch (order) {
      case 0:
        r = x0;
        break;
      case 1:
        r = x0 - x1;
        break;
      case 2:
        r = x0 - 2 * x1 + x2;
        break;
      case 3:
        r = x0 - 3 * x1 + 3 * x2 - x3;
        break;
      default:
        r = x0 - 4 * x1 + 6 * x2 - 4 * x3 + x4;
    }
    out[i - order] = r;
  }
  return out;
}

/** Fold a signed residual into the unsigned value Rice coding takes. */
function fold(r: number): number {
  return r >= 0 ? 2 * r : -2 * r - 1;
}

/** The Rice parameter that comes closest to a partition's mean, and the bits
 *  the partition then costs. */
function riceCost(
  residual: Int32Array,
  from: number,
  to: number,
): [number, number] {
  let sum = 0;
  for (let i = from; i < to; i++) sum += fold(residual[i] ?? 0);
  const count = to - from;
  const mean = count > 0 ? sum / count : 0;
  let k = 0;
  while (k < 14 && 1 << (k + 1) <= mean) k++;
  let bits = 4 + count * (k + 1);
  for (let i = from; i < to; i++) bits += fold(residual[i] ?? 0) >>> k;
  return [k, bits];
}

type Plan = {
  order: number;
  partitionOrder: number;
  params: number[];
  bits: number;
  residual: Int32Array;
};

/** Search the predictor and partition orders the level allows for the
 *  cheapest coding of one channel's block. */
function planChannel(
  samples: Int32Array,
  depth: number,
  level: FlacLevel,
): Plan | null {
  const n = samples.length;
  const orders = level === 0 ? [2] : [0, 1, 2, 3, 4];
  const maxPartition = level === 0 ? 0 : level === 5 ? 4 : 6;
  let best: Plan | null = null;
  for (const order of orders) {
    if (n <= order) continue;
    const residual = fixedResidual(samples, order);
    for (let p = 0; p <= maxPartition; p++) {
      const partitions = 1 << p;
      if (n % partitions !== 0) continue;
      const per = n / partitions;
      if (per <= order) continue;
      const params: number[] = [];
      let bits = order * depth + 2 + 4;
      let fits = true;
      for (let i = 0; i < partitions; i++) {
        const from = i === 0 ? 0 : i * per - order;
        const to = (i + 1) * per - order;
        const [k, cost] = riceCost(residual, from, to);
        // A partition whose values are wider than the depth cannot be Rice
        // coded sensibly; the escape is not implemented, so skip the plan.
        for (let j = from; j < to; j++) {
          if (Math.abs(residual[j] ?? 0) >= 2 ** (depth + 4)) fits = false;
        }
        params.push(k);
        bits += cost;
      }
      if (!fits) continue;
      if (!best || bits < best.bits)
        best = { order, partitionOrder: p, params, bits, residual };
    }
  }
  return best;
}

function writeSubframe(
  w: BitWriter,
  samples: Int32Array,
  depth: number,
  level: FlacLevel,
): void {
  const n = samples.length;
  // CONSTANT: every sample the same.
  let constant = true;
  for (let i = 1; i < n; i++) {
    if (samples[i] !== samples[0]) {
      constant = false;
      break;
    }
  }
  if (constant) {
    w.write(0, 1);
    w.write(0b000000, 6);
    w.write(0, 1);
    w.writeSigned(samples[0] ?? 0, depth);
    return;
  }
  const plan = planChannel(samples, depth, level);
  const verbatimBits = n * depth;
  if (!plan || plan.bits >= verbatimBits) {
    w.write(0, 1);
    w.write(0b000001, 6);
    w.write(0, 1);
    for (let i = 0; i < n; i++) w.writeSigned(samples[i] ?? 0, depth);
    return;
  }
  w.write(0, 1);
  w.write(0b001000 | plan.order, 6);
  w.write(0, 1);
  for (let i = 0; i < plan.order; i++) w.writeSigned(samples[i] ?? 0, depth);
  // Residual: Rice with 4-bit parameters.
  w.write(0b00, 2);
  w.write(plan.partitionOrder, 4);
  const partitions = 1 << plan.partitionOrder;
  const per = n / partitions;
  for (let i = 0; i < partitions; i++) {
    const k = plan.params[i] ?? 0;
    w.write(k, 4);
    const from = i === 0 ? 0 : i * per - plan.order;
    const to = (i + 1) * per - plan.order;
    for (let j = from; j < to; j++) {
      const u = fold(plan.residual[j] ?? 0);
      w.writeUnary(u >>> k);
      if (k > 0) w.write(u & ((1 << k) - 1), k);
    }
  }
}

const SAMPLE_RATE_CODES: Record<number, number> = {
  88200: 0b0001,
  176400: 0b0010,
  192000: 0b0011,
  8000: 0b0100,
  16000: 0b0101,
  22050: 0b0110,
  24000: 0b0111,
  32000: 0b1000,
  44100: 0b1001,
  48000: 0b1010,
  96000: 0b1011,
};

const SAMPLE_SIZE_CODES: Record<number, number> = {
  8: 0b001,
  12: 0b010,
  16: 0b100,
  20: 0b101,
  24: 0b110,
};

/** Encode a recording as FLAC. */
export function encodeFlac(pcm: Pcm, options: FlacOptions = {}): Uint8Array {
  const depth = options.depth ?? DEFAULT_FLAC_DEPTH;
  const level = options.level ?? DEFAULT_FLAC_LEVEL;
  const blockSize = options.blockSize ?? BLOCK_SIZE;
  const channels = Math.max(1, Math.min(8, pcm.channels.length));
  const total = frameCount(pcm);
  const sampleRate = Math.round(pcm.sampleRate);
  if (!(sampleRate > 0) || sampleRate >= 2 ** 20)
    throw new Error("unsupported sample rate");
  const ints = pcm.channels
    .slice(0, channels)
    .map((ch) => quantizeChannel(ch, depth));

  const w = new BitWriter();
  // "fLaC"
  for (const c of [0x66, 0x4c, 0x61, 0x43]) w.write(c, 8);
  // STREAMINFO, the last metadata block.
  w.write(1, 1);
  w.write(0, 7);
  w.write(34, 24);
  const lastBlock = total === 0 ? blockSize : ((total - 1) % blockSize) + 1;
  w.write(Math.min(blockSize, lastBlock), 16);
  w.write(blockSize, 16);
  w.write(0, 24);
  w.write(0, 24);
  w.write(sampleRate, 20);
  w.write(channels - 1, 3);
  w.write(depth - 1, 5);
  w.write(total, 36);
  for (let i = 0; i < 16; i++) w.write(0, 8);

  const rateCode = SAMPLE_RATE_CODES[sampleRate];
  const sizeCode = SAMPLE_SIZE_CODES[depth] ?? 0b100;
  let frame = 0;
  for (let start = 0; start < total; start += blockSize) {
    const n = Math.min(blockSize, total - start);
    const headerAt = w.length;
    w.write(0b11111111111110, 14);
    w.write(0, 1);
    w.write(0, 1);
    // Block size: 16 bits follow (code 0111), always, so the last, shorter
    // block is written the same way as the rest.
    w.write(0b0111, 4);
    if (rateCode !== undefined) w.write(rateCode, 4);
    else if (sampleRate < 65536) w.write(0b1101, 4);
    else w.write(0b1110, 4);
    w.write(channels - 1, 4);
    w.write(sizeCode, 3);
    w.write(0, 1);
    for (const b of utf8Number(frame)) w.write(b, 8);
    w.write(n - 1, 16);
    if (rateCode === undefined) {
      if (sampleRate < 65536) w.write(sampleRate, 16);
      else w.write(Math.round(sampleRate / 10), 16);
    }
    w.write(crc8(w.slice(headerAt)), 8);
    for (const ch of ints)
      writeSubframe(w, ch.subarray(start, start + n), depth, level);
    w.align();
    w.write(crc16(w.slice(headerAt)), 16);
    frame += 1;
  }
  return w.finish();
}
