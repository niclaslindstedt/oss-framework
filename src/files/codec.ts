// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The base64 `data:` URL ⇄ bytes codec. A local-first document that carries
// binary payloads inline stores them as data URLs; a cloud backend that files
// them out as real binary files needs the raw bytes back. These two pure
// helpers are that seam — no DOM, no knowledge of what the bytes are.

/** Parsed pieces of a base64 `data:` URL. */
export type DataUrlBytes = { mime: string; bytes: Uint8Array };

/** Decode a base64 `data:` URL into its MIME type and bytes, or null when the
 *  string isn't a base64 data URL. */
export function dataUrlToBytes(
  dataUrl: string | null | undefined,
): DataUrlBytes | null {
  if (!dataUrl) return null;
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match || !match[2]) return null;
  const mime = match[1] || "application/octet-stream";
  try {
    const binary = atob(match[3]!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes };
  } catch {
    return null;
  }
}

/** Encode bytes + MIME type into a base64 `data:` URL. Chunked so a large
 *  payload doesn't blow the argument limit of `String.fromCharCode(...spread)`. */
export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
