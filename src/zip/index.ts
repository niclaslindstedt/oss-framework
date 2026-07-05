// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ZIP archives: a dependency-free reader/writer over the platform's
// `CompressionStream`/`DecompressionStream` (`deflate-raw`), with CRC-32
// checksums and a stored-entry fallback where the codec is missing. Implements
// the minimal APPNOTE subset a local-first export/backup needs — single disk,
// no ZIP64, no encryption, UTF-8 names. See ./README.md.

export { createZip, readZip, type ZipEntry } from "./zip.ts";
