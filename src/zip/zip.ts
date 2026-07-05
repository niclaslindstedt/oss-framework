// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A tiny, dependency-free ZIP reader/writer. Local-first apps routinely pack a
// serialized document — often with base64 payloads inline — into one archive
// for export/backup, so a good compressor matters: repetitive text deflates to
// a fraction of its size. Rather than pull in a zip dependency, this leans on
// the platform's `CompressionStream`/`DecompressionStream` (`deflate-raw`),
// which every modern browser and Node ≥ 22 ship, and falls back to a stored
// (uncompressed) entry where the raw-deflate codec is missing — so an archive
// is always writable and readable, just larger without it.
//
// Only the sliver of the ZIP spec (APPNOTE.TXT) this needs is implemented:
// single-disk archives, no ZIP64, no encryption, no data descriptors (sizes
// are known before the local header is written). Names are stored UTF-8.

/** One file inside an archive: a `/`-separated name and its raw bytes. */
export type ZipEntry = { name: string; data: Uint8Array };

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

// --- CRC-32 (IEEE 802.3), the checksum every ZIP entry carries ---------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- raw DEFLATE via the platform streams ------------------------------------

/** Whether the platform can do raw DEFLATE — memoised, since building a probe
 *  stream isn't free. When false, entries are stored uncompressed. */
let deflateRawOk: boolean | null = null;
function canDeflateRaw(): boolean {
  if (deflateRawOk !== null) return deflateRawOk;
  try {
    // Constructing throws where the codec isn't registered.
    new CompressionStream("deflate-raw");
    deflateRawOk = true;
  } catch {
    deflateRawOk = false;
  }
  return deflateRawOk;
}

async function pump(
  bytes: Uint8Array,
  transform: GenericTransformStream,
): Promise<Uint8Array> {
  const piped = new Response(bytes as BodyInit).body!.pipeThrough(transform);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pump(bytes, new CompressionStream("deflate-raw"));
}

function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pump(bytes, new DecompressionStream("deflate-raw"));
}

// --- little-endian helpers ---------------------------------------------------

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}
function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

/** Encode a `Date` into the DOS date/time pair ZIP records carry. Values before
 *  1980 (the DOS epoch) clamp to it rather than underflow. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

// --- writing -----------------------------------------------------------------

type Packed = {
  nameBytes: Uint8Array;
  method: number;
  crc: number;
  comp: Uint8Array;
  uncompSize: number;
  offset: number;
};

/** Build a ZIP archive from a set of entries. Each entry is DEFLATE-compressed
 *  where the platform supports it (and only when compression actually shrinks
 *  it), else stored. `modifiedAt` stamps every record's mtime (defaults to
 *  now). */
export async function createZip(
  entries: readonly ZipEntry[],
  modifiedAt: Date = new Date(),
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modifiedAt);
  const useDeflate = canDeflateRaw();

  const packed: Packed[] = [];
  let offset = 0;
  const localChunks: Uint8Array[] = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    let method = METHOD_STORE;
    let comp = entry.data;
    if (useDeflate && entry.data.length > 0) {
      const deflated = await deflateRaw(entry.data);
      // Only take the compressed form when it actually helps.
      if (deflated.length < entry.data.length) {
        method = METHOD_DEFLATE;
        comp = deflated;
      }
    }

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    u32(view, 0, LOCAL_SIG);
    u16(view, 4, 20); // version needed
    u16(view, 6, 0); // flags
    u16(view, 8, method);
    u16(view, 10, time);
    u16(view, 12, date);
    u32(view, 14, crc);
    u32(view, 18, comp.length);
    u32(view, 22, entry.data.length);
    u16(view, 26, nameBytes.length);
    u16(view, 28, 0); // extra len
    header.set(nameBytes, 30);

    localChunks.push(header, comp);
    packed.push({
      nameBytes,
      method,
      crc,
      comp,
      uncompSize: entry.data.length,
      offset,
    });
    offset += header.length + comp.length;
  }

  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  for (const p of packed) {
    const record = new Uint8Array(46 + p.nameBytes.length);
    const view = new DataView(record.buffer);
    u32(view, 0, CENTRAL_SIG);
    u16(view, 4, 20); // version made by
    u16(view, 6, 20); // version needed
    u16(view, 8, 0); // flags
    u16(view, 10, p.method);
    u16(view, 12, time);
    u16(view, 14, date);
    u32(view, 16, p.crc);
    u32(view, 20, p.comp.length);
    u32(view, 24, p.uncompSize);
    u16(view, 28, p.nameBytes.length);
    u16(view, 30, 0); // extra len
    u16(view, 32, 0); // comment len
    u16(view, 34, 0); // disk number start
    u16(view, 36, 0); // internal attrs
    u32(view, 38, 0); // external attrs
    u32(view, 42, p.offset);
    record.set(p.nameBytes, 46);
    centralChunks.push(record);
    centralSize += record.length;
  }

  const eocd = new Uint8Array(22);
  const eview = new DataView(eocd.buffer);
  u32(eview, 0, EOCD_SIG);
  u16(eview, 4, 0); // disk number
  u16(eview, 6, 0); // disk with central dir
  u16(eview, 8, packed.length);
  u16(eview, 10, packed.length);
  u32(eview, 12, centralSize);
  u32(eview, 16, offset); // central dir offset
  u16(eview, 20, 0); // comment len

  return concat([...localChunks, ...centralChunks, eocd]);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// --- reading -----------------------------------------------------------------

/** Read every entry out of a ZIP archive, inflating DEFLATE-compressed ones.
 *  Walks the central directory (the authoritative index) rather than trusting
 *  the stream order. Throws on a missing/corrupt directory. */
export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view, bytes.length);
  if (eocd < 0)
    throw new Error("Not a ZIP archive (no end-of-directory record)");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(ptr, true) !== CENTRAL_SIG) {
      throw new Error("Corrupt ZIP central directory");
    }
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    // The local header repeats the name/extra lengths; the data starts past them.
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);

    const data =
      method === METHOD_DEFLATE ? await inflateRaw(comp) : comp.slice();
    out.push({ name, data });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Scan backwards for the end-of-central-directory signature. The record can
 *  carry a trailing comment, so we search the last 64 KiB + 22 bytes. */
function findEocd(view: DataView, length: number): number {
  const min = Math.max(0, length - 22 - 0xffff);
  for (let i = length - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  return -1;
}
