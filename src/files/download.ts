// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Browser download glue: wrap a rendered document in a Blob and click a
// transient anchor at it. Kept apart from any renderer so those stay pure and
// node-testable — this file is the only part that touches the DOM.

/** Save a rendered text document under `filename` with the given MIME type. */
export function downloadText(
  filename: string,
  text: string,
  mime: string,
): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

/** Click a transient anchor at a Blob to save it under `filename`. The binary
 *  counterpart to {@link downloadText}. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Common MIME types for the export formats local-first apps write, so every
// adopter doesn't re-spell the charset suffix.
export const MIME_TEXT = "text/plain;charset=utf-8";
export const MIME_CSV = "text/csv;charset=utf-8";
export const MIME_JSON = "application/json;charset=utf-8";
export const MIME_VCARD = "text/vcard;charset=utf-8";
export const MIME_ICS = "text/calendar;charset=utf-8";
export const MIME_ZIP = "application/zip";
