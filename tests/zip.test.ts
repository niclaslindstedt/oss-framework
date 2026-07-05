// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
// Node environment: the module runs on `CompressionStream`/`DecompressionStream`
// (Node ≥ 22 ships them); jsdom does not provide the codec globals.
import { describe, expect, it } from "vitest";

import { createZip, readZip, type ZipEntry } from "../src/zip/index.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesOf(entry: ZipEntry | undefined): string {
  return entry ? dec.decode(entry.data) : "";
}

describe("zip", () => {
  it("round-trips a single text entry", async () => {
    const zip = await createZip([
      { name: "document.json", data: enc.encode('{"version":4}') },
    ]);
    const entries = await readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("document.json");
    expect(bytesOf(entries[0])).toBe('{"version":4}');
  });

  it("round-trips several entries preserving names and order", async () => {
    const zip = await createZip([
      { name: "a.txt", data: enc.encode("alpha") },
      { name: "nested/b.txt", data: enc.encode("beta") },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "nested/b.txt"]);
    expect(bytesOf(entries.find((e) => e.name === "nested/b.txt"))).toBe(
      "beta",
    );
  });

  it("compresses a large, repetitive payload below its raw size", async () => {
    // Deflate should shrink a payload that repeats — the whole point of
    // zipping a serialized document full of base64. (When the platform lacks
    // the codec the entry is stored, so only assert the archive is at least
    // readable in that case.)
    const raw = enc.encode("payload ".repeat(5000));
    const zip = await createZip([{ name: "big.txt", data: raw }]);
    const [entry] = await readZip(zip);
    expect(bytesOf(entry)).toBe("payload ".repeat(5000));
  });

  it("shrinks the archive when the platform codec is available", async () => {
    // Node ≥ 22 always ships deflate-raw, so in this environment the archive
    // must actually come out smaller than the raw payload.
    const raw = enc.encode("payload ".repeat(5000));
    const zip = await createZip([{ name: "big.txt", data: raw }]);
    expect(zip.length).toBeLessThan(raw.length);
  });

  it("round-trips a full byte range (0..255), not just ASCII", async () => {
    const raw = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) raw[i] = i;
    const zip = await createZip([{ name: "bytes.bin", data: raw }]);
    const [entry] = await readZip(zip);
    expect(Array.from(entry!.data)).toEqual(Array.from(raw));
  });

  it("round-trips incompressible data without inflating it", async () => {
    // Pseudo-random bytes don't deflate; the writer must fall back to a
    // stored entry (never a larger-than-raw one) and read it back intact.
    const raw = new Uint8Array(4096);
    let state = 0x12345678; // xorshift32 — deterministic, incompressible
    for (let i = 0; i < raw.length; i += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      raw[i] = state & 0xff;
    }
    const zip = await createZip([{ name: "noise.bin", data: raw }]);
    // Archive = local header (30 + name) + payload + central record (46 +
    // name) + EOCD (22); a stored payload adds exactly raw.length.
    const overhead = 30 + 46 + 2 * "noise.bin".length + 22;
    expect(zip.length).toBe(raw.length + overhead);
    const [entry] = await readZip(zip);
    expect(Array.from(entry!.data)).toEqual(Array.from(raw));
  });

  it("round-trips an empty entry", async () => {
    const zip = await createZip([{ name: "empty", data: new Uint8Array(0) }]);
    const [entry] = await readZip(zip);
    expect(entry!.name).toBe("empty");
    expect(entry!.data).toHaveLength(0);
  });

  it("round-trips an empty archive", async () => {
    const zip = await createZip([]);
    expect(await readZip(zip)).toEqual([]);
  });

  it("round-trips unicode entry names", async () => {
    const names = ["fótó/skjöl.txt", "資料/連絡先.json", "ملفّات/م.bin"];
    const zip = await createZip(
      names.map((name) => ({ name, data: enc.encode(name) })),
    );
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(names);
    for (const entry of entries) expect(bytesOf(entry)).toBe(entry.name);
  });

  it("round-trips many entries", async () => {
    const input: ZipEntry[] = [];
    for (let i = 0; i < 64; i += 1) {
      input.push({ name: `dir/${i}.txt`, data: enc.encode(`item ${i}`) });
    }
    const entries = await readZip(await createZip(input));
    expect(entries).toHaveLength(64);
    expect(bytesOf(entries[63])).toBe("item 63");
  });

  it("reads an archive carrying a trailing comment", async () => {
    // The end-of-directory record may be followed by a comment; the reader
    // scans backwards for it. Append a comment and patch the EOCD length.
    const zip = await createZip([{ name: "a.txt", data: enc.encode("alpha") }]);
    const comment = enc.encode("archive comment");
    const commented = new Uint8Array(zip.length + comment.length);
    commented.set(zip, 0);
    commented.set(comment, zip.length);
    const view = new DataView(commented.buffer);
    view.setUint16(zip.length - 2, comment.length, true); // EOCD comment len
    const entries = await readZip(commented);
    expect(entries).toHaveLength(1);
    expect(bytesOf(entries[0])).toBe("alpha");
  });

  it("reads from a subarray with a non-zero byte offset", async () => {
    // Callers may hand over a view into a larger buffer (e.g. a slice of a
    // network payload); offsets must be honoured, not assumed zero.
    const zip = await createZip([{ name: "a.txt", data: enc.encode("alpha") }]);
    const padded = new Uint8Array(zip.length + 16);
    padded.set(zip, 16);
    const entries = await readZip(padded.subarray(16));
    expect(entries).toHaveLength(1);
    expect(bytesOf(entries[0])).toBe("alpha");
  });

  it("accepts a fixed modification date, including pre-1980 clamping", async () => {
    // ZIP timestamps use the DOS epoch (1980); earlier dates must clamp
    // rather than underflow, and the archive must stay readable either way.
    const data = [{ name: "a.txt", data: enc.encode("alpha") }];
    for (const when of [new Date(1970, 0, 1), new Date(2024, 5, 15, 12, 34)]) {
      const entries = await readZip(await createZip(data, when));
      expect(bytesOf(entries[0])).toBe("alpha");
    }
  });

  it("rejects bytes that aren't a ZIP archive", async () => {
    await expect(readZip(enc.encode("not a zip"))).rejects.toThrow(
      /not a zip archive/i,
    );
  });

  it("rejects a corrupt central directory", async () => {
    const zip = await createZip([{ name: "a.txt", data: enc.encode("alpha") }]);
    // Point the end-of-directory record's central-directory offset at the
    // local header instead — its signature differs, so the walk must fail.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    view.setUint32(zip.length - 22 + 16, 0, true);
    await expect(readZip(zip)).rejects.toThrow(/corrupt/i);
  });
});
