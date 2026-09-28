// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hand a file to the user, wherever the page is running.
//
// In a browser tab or an installed PWA that is a download: `downloadBlob`
// clicks an anchor at an object URL. Inside a phone app's native shell the
// same click goes nowhere — the WebView offers a `blob:` URL to the shell as a
// navigation, and the shell has nothing to open it with. So when the shell has
// advertised the `save-file` capability (see ../pwa/nativeShell.ts), the bytes
// cross the bridge instead, as base64, and the shell writes them to a
// temporary file and opens the platform share sheet — from which the user
// saves to Files, AirDrops, mails it, or whatever the phone offers.
//
// The message contract, and a reference implementation of the shell's half,
// are in docs/native-shell.md. Keep the two in step: a renamed field here is an
// export that silently never arrives.

import { nativeShellCan, postToNativeShell } from "../pwa/nativeShell.ts";
import { bytesToBase64 } from "./codec.ts";
import { downloadBlob, MIME_TEXT } from "./download.ts";

/** The message the page posts to the shell. */
export const SAVE_FILE_MESSAGE = "oss-framework/save-file";

/** The window event the shell dispatches with the outcome. */
export const SAVE_FILE_RESULT_EVENT = "oss-framework/save-file-result";

/** What to save. Give the bytes as a `blob`, or a rendered document as
 *  `text` (encoded as UTF-8). */
export type SaveFileInput = {
  /** The name the file is offered under, extension included. */
  filename: string;
  /** Its MIME type. Defaults to the blob's own type, or plain UTF-8 text. */
  mimeType?: string;
} & ({ blob: Blob; text?: never } | { text: string; blob?: never });

/** How the file left the page: a browser download, or the native share
 *  sheet. */
export type SaveFileOutcome = "downloaded" | "shared";

/** The page-to-shell message, version 1. */
export interface SaveFileMessage {
  type: typeof SAVE_FILE_MESSAGE;
  version: 1;
  /** Correlates the result with this request. */
  id: string;
  /** A bare file name — no directory part. */
  filename: string;
  /** The MIME type without parameters (`text/csv`, not `text/csv;charset=…`). */
  mimeType: string;
  /** The file's bytes, base64. */
  base64: string;
}

/** The shell-to-page result, carried as the `detail` of a
 *  `SAVE_FILE_RESULT_EVENT` on `window`. */
export type SaveFileResult =
  { id: string; ok: true } | { id: string; ok: false; error?: string };

let nextId = 0;

/** Strip anything that would make the name a path, and control characters. */
function bareFilename(name: string): string {
  const bare = Array.from(name.replace(/[\\/]/g, "_"))
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return bare === "" || bare === "." || bare === ".." ? "file" : bare;
}

/** `text/csv;charset=utf-8` → `text/csv`. */
function bareMime(mime: string): string {
  return mime.split(";")[0]!.trim() || "application/octet-stream";
}

function blobOf(input: SaveFileInput): Blob {
  if (input.blob) {
    const { blob, mimeType } = input;
    return mimeType && mimeType !== blob.type
      ? new Blob([blob], { type: mimeType })
      : blob;
  }
  return new Blob([input.text ?? ""], { type: input.mimeType ?? MIME_TEXT });
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function shareThroughShell(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<SaveFileOutcome> {
  return bytesOf(blob).then(
    (bytes) =>
      new Promise<SaveFileOutcome>((resolve, reject) => {
        nextId += 1;
        const id = `sf${Date.now().toString(36)}-${nextId}`;
        const onResult = (event: Event) => {
          const result = (event as CustomEvent<SaveFileResult>).detail;
          if (!result || result.id !== id) return;
          window.removeEventListener(SAVE_FILE_RESULT_EVENT, onResult);
          if (result.ok) resolve("shared");
          else
            reject(new Error(result.error || "The file could not be shared."));
        };
        window.addEventListener(SAVE_FILE_RESULT_EVENT, onResult);
        const message: SaveFileMessage = {
          type: SAVE_FILE_MESSAGE,
          version: 1,
          id,
          filename,
          mimeType,
          base64: bytesToBase64(bytes),
        };
        if (!postToNativeShell(message)) {
          window.removeEventListener(SAVE_FILE_RESULT_EVENT, onResult);
          reject(new Error("The native shell could not be reached."));
        }
      }),
  );
}

/**
 * Save a file for the user: a browser download on the web, the share sheet in a
 * native shell that advertises `save-file`.
 *
 * Resolves with how it left (`"downloaded"` at once on the web; `"shared"` once
 * the shell reports the sheet was shown and closed). Rejects when the shell
 * reports a failure, so the caller can say so — a download that silently did
 * nothing is the bug this exists to fix. Nothing times out: the share sheet
 * stays open as long as the user leaves it open.
 */
export async function saveFile(input: SaveFileInput): Promise<SaveFileOutcome> {
  const blob = blobOf(input);
  const filename = bareFilename(input.filename);
  if (nativeShellCan("save-file")) {
    const mimeType = bareMime(input.mimeType ?? blob.type ?? "");
    return shareThroughShell(blob, filename, mimeType);
  }
  downloadBlob(filename, blob);
  return "downloaded";
}
