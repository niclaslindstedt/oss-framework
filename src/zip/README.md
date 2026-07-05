<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `zip` — a dependency-free ZIP reader/writer

Local-first apps eventually need to hand the user their data as **one file** —
an export, a backup, a bundle of a document plus its binary payloads. A ZIP
archive is the universal container for that, and compression matters: a
serialized document full of repetitive text (or base64-encoded binaries)
deflates to a fraction of its size. This module is that container, with zero
dependencies:

- **`createZip`** — packs a list of named byte entries into a ZIP archive,
  DEFLATE-compressing each entry via the platform's `CompressionStream`
  (`deflate-raw`) and computing the CRC-32 every ZIP record carries.
- **`readZip`** — reads every entry back out, walking the central directory
  (the archive's authoritative index) and inflating compressed entries via
  `DecompressionStream`.

No React, no DOM, no bundled compressor — just Web APIs that every modern
browser and Node ≥ 22 ship. Where the `deflate-raw` codec is missing, entries
are **stored** uncompressed instead, so an archive is always writable and
readable, just larger. An entry that doesn't shrink under DEFLATE (already-
compressed data) is also stored, never inflated in size.

```ts
import {
  createZip,
  readZip,
  type ZipEntry,
} from "@niclaslindstedt/oss-framework/zip";
```

## What it owns vs. what stays in your app

The module moves bytes in and out of an archive. What those bytes _are_ — which
files exist, how a document serializes, what a restore does with the entries —
is your app's concern.

| In the framework                                    | In your app                                                |
| --------------------------------------------------- | ---------------------------------------------------------- |
| the ZIP container format (headers, directory, EOCD) | the entry set: names, layout, and what each file contains  |
| CRC-32 + DEFLATE / stored-entry decisions           | serializing your document into bytes (and parsing it back) |
| reading the central directory back into entries     | validating / migrating the extracted content               |
| UTF-8 entry names, DOS timestamps                   | triggering the download / picking the file to import       |

## Generic usage

### Writing an archive

An entry is just `{ name, data }` — a `/`-separated path and raw bytes. Names
are stored UTF-8, so any script works.

```ts
const encoder = new TextEncoder();
const bytes = await createZip([
  { name: "document.json", data: encoder.encode(JSON.stringify(doc)) },
  { name: "media/photo-1.jpg", data: photoBytes },
]);

// Hand it to the user however your app downloads files:
const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
```

Pass a `Date` as the second argument to stamp every record's modification time
deterministically (it defaults to now):

```ts
const bytes = await createZip(entries, new Date(doc.updatedAt));
```

### Reading one back

```ts
const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
for (const { name, data } of entries) {
  // data is the fully inflated Uint8Array for that entry.
}
```

`readZip` throws on bytes that aren't a ZIP archive (no end-of-directory
record) or whose central directory is corrupt — catch and surface that as your
"this file isn't a valid backup" state.

## Scope — the supported ZIP subset

Only the sliver of the spec (APPNOTE.TXT) a local-first export/backup needs is
implemented, on purpose:

- single-disk archives; no ZIP64 — entries and archive must stay under 4 GiB
  and 65 535 entries;
- methods `store` (0) and `deflate` (8) only — no encryption, no data
  descriptors (sizes are known before each local header is written);
- trailing archive comments are tolerated when reading (the end-of-directory
  scan covers the maximal 64 KiB comment), never written.

Archives it writes open in every mainstream unzipper; reading handles anything
within that subset, wherever it was written.

## Adapting to your app

- **You bundle text plus binaries.** Just add entries — each one gets its own
  store-vs-deflate decision, so a JPEG rides along stored while the JSON next
  to it compresses.
- **You want folders.** ZIP has no directory objects in this subset; use
  `/`-separated entry names (`media/a.jpg`) and every extractor recreates the
  tree.
- **You need deterministic output** (byte-identical archives for identical
  input, e.g. for tests or content hashing). Pass a fixed `modifiedAt`; entry
  order is preserved exactly as given.
- **You target an environment without `deflate-raw`.** Nothing to do — the
  writer probes once and falls back to stored entries; the reader only needs
  `DecompressionStream` when it meets a deflated entry.

## Verification

- `readZip(await createZip([{ name, data }]))` returns the same names and
  bytes, for empty entries, full-byte-range binaries, and multi-kilobyte
  repetitive text (which comes back smaller than raw in the archive).
- `readZip` rejects non-ZIP bytes with "Not a ZIP archive".
- In a consuming app: export an archive, open it with the system unzipper, and
  confirm the file tree and contents; re-import the same file and confirm the
  round-trip.
