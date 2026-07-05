// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Turning picked / dropped File objects into inline payloads. A file that must
// round-trip byte-for-byte is read straight to a base64 `data:` URL (no
// re-encoding), gated by a byte-size cap so an oversized upload is refused
// rather than silently overflowing a storage quota. This is the DOM half
// (FileReader) of an upload feature; what the app *makes* of the data — ids,
// records, list mechanics — stays with the app.

/** A successfully read file: its metadata plus the bytes as a base64 `data:`
 *  URL. Plain data — the caller wraps it in its own record type. */
export type ReadFileData = {
  /** The file's name, falling back to "file" when the pick carried none. */
  name: string;
  /** The file's MIME type, falling back to a generic octet-stream so an
   *  extension-less file still round-trips. */
  type: string;
  /** Size in bytes. */
  size: number;
  /** The exact bytes as a base64 `data:` URL. */
  dataUrl: string;
};

/** Why a file was refused — surfaced so the UI can tell the user rather than
 *  dropping the file on the floor. */
export type ReadFileRejection = {
  name: string;
  size: number;
  reason: "too-large" | "read-failed";
};

/** The outcome of reading a batch of picked files: the ones that were read,
 *  and the ones that were refused (too large / unreadable). */
export type FileIntake = {
  accepted: ReadFileData[];
  rejected: ReadFileRejection[];
};

/** Read one File into a base64 `data:` URL, preserving its exact bytes. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Read a batch of picked files into inline payloads, partitioning them into
 *  the accepted and the refused. A file larger than `maxBytes` (when given) is
 *  rejected with reason "too-large" without being read; a file the browser
 *  can't read is rejected with "read-failed". */
export async function readFilesWithLimit(
  files: readonly File[],
  options: { maxBytes?: number } = {},
): Promise<FileIntake> {
  const { maxBytes } = options;
  const accepted: ReadFileData[] = [];
  const rejected: ReadFileRejection[] = [];
  const results = await Promise.all(
    files.map(async (file): Promise<ReadFileData | ReadFileRejection> => {
      if (maxBytes != null && file.size > maxBytes) {
        return { name: file.name, size: file.size, reason: "too-large" };
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        return {
          name: file.name || "file",
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
        };
      } catch {
        return { name: file.name, size: file.size, reason: "read-failed" };
      }
    }),
  );
  for (const r of results) {
    if ("dataUrl" in r) accepted.push(r);
    else rejected.push(r);
  }
  return { accepted, rejected };
}
