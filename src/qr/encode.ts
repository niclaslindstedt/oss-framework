// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// QR Code Model 2 encoder (ISO/IEC 18004), byte mode, all 40 versions and
// four error-correction levels, with automatic mask selection. Pure and
// dependency-free (the framework takes no runtime dependencies); verified in
// tests by decoding the output with an independent decoder. The same encoder
// ships in storage-server for its terminal and admin-page QR codes.

export type Ecl = "L" | "M" | "Q" | "H";

export type QrCode = {
  version: number;
  size: number;
  ecl: Ecl;
  mask: number;
  /** modules[y][x] — true is dark. */
  modules: boolean[][];
};

const ECL_ORDINAL: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Error-correction codewords per block, by level then version (index 0 unused).
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30,
    28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
    26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28,
    26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28,
    26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ],
];

// Number of error-correction blocks, by level then version.
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10,
    12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17,
    17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23,
    23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
    25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77,
    81,
  ],
];

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number, ecl: Ecl): number {
  const e = ECL_ORDINAL[ecl];
  return (
    Math.floor(rawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e]![ver]! * NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!
  );
}

// ---- Reed–Solomon over GF(2^8), polynomial 0x11D ---------------------------

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(
  data: readonly number[],
  divisor: readonly number[],
): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i]! ^= gfMul(coef, factor);
    });
  }
  return result;
}

// ---- data encoding --------------------------------------------------------------

function encodeData(bytes: Uint8Array, ver: number, ecl: Ecl): number[] {
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!;
    out.push(b);
  }
  return out;
}

function addEccAndInterleave(data: number[], ver: number, ecl: Ecl): number[] {
  const e = ECL_ORDINAL[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![ver]!;
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(
      k,
      k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1),
    );
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push([...dat, ...ecc]);
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
        result.push(block[i]!);
    });
  }
  return result;
}

// ---- module placement -----------------------------------------------------------

class Matrix {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    );
    this.isFunction = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    );
  }
  setFn(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }
}

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step =
    ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step)
    result.splice(1, 0, pos);
  return result;
}

function drawFunctionPatterns(m: Matrix, ver: number): void {
  const size = m.size;
  for (let i = 0; i < size; i++) {
    m.setFn(6, i, i % 2 === 0);
    m.setFn(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size)
          m.setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const pos = alignmentPositions(ver, size);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === n - 1) ||
        (i === n - 1 && j === 0)
      )
        continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          m.setFn(
            pos[i]! + dx,
            pos[j]! + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
  }
  drawFormatBits(m, "M", 0); // reserve; overwritten after masking
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      m.setFn(a, b, bit);
      m.setFn(b, a, bit);
    }
  }
}

function drawFormatBits(m: Matrix, ecl: Ecl, mask: number): void {
  const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  const size = m.size;
  for (let i = 0; i <= 5; i++) m.setFn(8, i, bit(i));
  m.setFn(8, 7, bit(6));
  m.setFn(8, 8, bit(7));
  m.setFn(7, 8, bit(8));
  for (let i = 9; i < 15; i++) m.setFn(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) m.setFn(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) m.setFn(8, size - 15 + i, bit(i));
  m.setFn(8, size - 8, true);
}

function drawCodewords(m: Matrix, data: number[]): void {
  const size = m.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!m.isFunction[y]![x] && i < data.length * 8) {
          m.modules[y]![x] = ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m: Matrix, mask: number): void {
  const f = MASKS[mask]!;
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.isFunction[y]![x] && f(x, y)) m.modules[y]![x] = !m.modules[y]![x];
    }
  }
}

/** The standard's four penalty rules; lower is easier to scan. */
function penalty(mods: boolean[][]): number {
  const size = mods.length;
  let score = 0;
  const line = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j <= size; j++) {
        if (j < size && get(i, j) === get(i, j - 1)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      for (let j = 0; j + 10 < size + 4; j++) {
        const at = (k: number) => (k < 0 || k >= size ? false : get(i, k));
        const core = [true, false, true, true, true, false, true];
        const matchCore = (start: number) =>
          core.every((v, k) => at(start + k) === v);
        if (matchCore(j) && [1, 2, 3, 4].every((k) => !at(j - k))) score += 40;
        if (matchCore(j) && [7, 8, 9, 10].every((k) => !at(j + k))) score += 40;
      }
    }
  };
  line((i, j) => mods[i]![j]!);
  line((i, j) => mods[j]![i]!);
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mods[y]![x];
      if (
        c === mods[y]![x + 1] &&
        c === mods[y + 1]![x] &&
        c === mods[y + 1]![x + 1]
      )
        score += 3;
    }
  }
  let dark = 0;
  for (const row of mods) for (const v of row) if (v) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

export type QrOptions = { ecl?: Ecl; mask?: number; minVersion?: number };

/** Encode text (UTF-8, byte mode) as a QR code. */
export function encodeQr(text: string, options: QrOptions = {}): QrCode {
  const ecl = options.ecl ?? "M";
  const bytes = new TextEncoder().encode(text);
  let ver = Math.max(1, options.minVersion ?? 1);
  for (; ; ver++) {
    if (ver > 40) throw new Error("data too long for a QR code");
    const needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= dataCodewords(ver, ecl) * 8) break;
  }
  const codewords = addEccAndInterleave(encodeData(bytes, ver, ecl), ver, ecl);
  const size = ver * 4 + 17;

  const build = (mask: number): Matrix => {
    const m = new Matrix(size);
    drawFunctionPatterns(m, ver);
    drawCodewords(m, codewords);
    applyMask(m, mask);
    drawFormatBits(m, ecl, mask);
    return m;
  };

  let mask = options.mask ?? -1;
  let best: Matrix | null = null;
  if (mask >= 0 && mask <= 7) {
    best = build(mask);
  } else {
    let bestScore = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      const m = build(candidate);
      const s = penalty(m.modules);
      if (s < bestScore) {
        bestScore = s;
        best = m;
        mask = candidate;
      }
    }
  }
  return { version: ver, size, ecl, mask, modules: best!.modules };
}
