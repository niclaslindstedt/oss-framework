// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Opening a stored binary payload in the browser. A viewable file (say, a PDF)
// opens in a new tab; the save counterparts land it on disk instead. Payloads
// stored as `data:` URLs are decoded to a real Blob first so the browser gets a
// genuine typed document rather than a giant `data:` URL, which some browsers
// refuse to navigate to.

import { dataUrlToBytes } from "./codec.ts";
import { downloadBlob } from "./download.ts";

/** How long an object URL handed to a new tab stays alive before it is
 *  revoked — long enough for the tab to finish loading it. */
const REVOKE_AFTER_MS = 60_000;

/** Decode a base64 `data:` URL into a Blob tagged with `mime` (falling back to
 *  the MIME type embedded in the URL), or null when the string isn't a base64
 *  data URL. */
export function dataUrlToBlob(
  dataUrl: string | null | undefined,
  mime?: string,
): Blob | null {
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return null;
  return new Blob([parsed.bytes as BlobPart], { type: mime || parsed.mime });
}

/** Open a Blob in a new browser tab. The object URL is revoked after a grace
 *  period so the opened tab has time to load it; if the popup was blocked
 *  there's nothing to load and the timeout just cleans up. */
export function openBlobInTab(
  blob: Blob,
  revokeAfterMs: number = REVOKE_AFTER_MS,
): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
}

/** Open a payload stored as a base64 `data:` URL in a new tab. Returns false
 *  when the bytes couldn't be prepared, so the caller can fall back to a
 *  download or an error message. */
export function openDataUrlInTab(
  dataUrl: string | null | undefined,
  mime?: string,
): boolean {
  const blob = dataUrlToBlob(dataUrl, mime);
  if (!blob) return false;
  openBlobInTab(blob);
  return true;
}

/** Save a payload stored as a base64 `data:` URL to disk under `filename`.
 *  Returns false when the bytes couldn't be prepared. */
export function saveDataUrl(
  filename: string,
  dataUrl: string | null | undefined,
  mime?: string,
): boolean {
  const blob = dataUrlToBlob(dataUrl, mime);
  if (!blob) return false;
  downloadBlob(filename, blob);
  return true;
}
