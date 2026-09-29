// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Read a QR code with the phone's camera, from inside the page.
//
// A browser tab has no scanner the page can rely on, but a phone app's native
// shell does: when it advertises the `scan-qr` capability (see
// ../pwa/nativeShell.ts), the page asks it to scan and the shell opens its own
// full-screen camera, reads one code, closes, and answers with the text. The
// camera permission is asked for then — when the user asked to scan — not at
// launch; no frame is kept or sent, only the decoded text crosses the bridge.
//
// Everywhere else scanning is unavailable, and `canScanQrCode()` says so up
// front, so an app shows its Scan button only where it works and keeps the
// paste field in every build.
//
// The message contract, and a reference implementation of the shell's half,
// are in docs/native-shell.md. Keep the two in step: a renamed field here is a
// scan whose answer never arrives.

import { nativeShellCan, postToNativeShell } from "../pwa/nativeShell.ts";

/** The message the page posts to the shell. */
export const SCAN_QR_MESSAGE = "oss-framework/scan-qr";

/** The window event the shell dispatches with the outcome. */
export const SCAN_QR_RESULT_EVENT = "oss-framework/scan-qr-result";

/** The words the shell's scanner shows, in the page's language. Each one the
 *  page leaves out falls back to the shell's own. */
export interface ScanQrLabels {
  /** A line over the camera, e.g. "Point the camera at the pairing code". */
  hint?: string;
  /** The button that closes the scanner without a code. */
  cancel?: string;
}

/** The page-to-shell message, version 1. */
export interface ScanQrMessage {
  type: typeof SCAN_QR_MESSAGE;
  version: 1;
  /** Correlates the result with this request. */
  id: string;
  /** The scanner's words, when the page gave any. */
  labels?: ScanQrLabels;
}

/** Why a scan could not happen. `denied`: the user has not let the app use
 *  the camera (just now, or earlier and the system will not ask again).
 *  `unavailable`: there is no scanner — no shell capability, no camera, or the
 *  shell failed to open it. */
export type ScanQrFailure = "denied" | "unavailable";

/** The shell-to-page result, carried as the `detail` of a
 *  `SCAN_QR_RESULT_EVENT` on `window`. `text: null` is a cancel. */
export type ScanQrResult =
  | { id: string; ok: true; text: string | null }
  | { id: string; ok: false; reason: ScanQrFailure; error?: string };

/** A scan that could not happen; `reason` says which way the page should
 *  lead the user (to Settings, or to the paste field). */
export class ScanQrError extends Error {
  readonly reason: ScanQrFailure;

  constructor(reason: ScanQrFailure, message?: string) {
    super(
      message ||
        (reason === "denied"
          ? "Camera access is off for this app."
          : "Scanning is not available here."),
    );
    this.name = "ScanQrError";
    this.reason = reason;
  }
}

/** True when this page can scan a QR code: it runs in a native shell that
 *  advertised `scan-qr`. Stable for the page's life (the shell declares it
 *  before the page loads), so it is safe to call while rendering. */
export function canScanQrCode(): boolean {
  return nativeShellCan("scan-qr");
}

let nextId = 0;
let pending: Promise<string | null> | null = null;

function settle(
  result: ScanQrResult,
  resolve: (text: string | null) => void,
  reject: (error: ScanQrError) => void,
): void {
  if (result.ok) {
    if (result.text === null || typeof result.text === "string") {
      resolve(result.text);
      return;
    }
    reject(new ScanQrError("unavailable", "The scanner returned no text."));
    return;
  }
  const reason = result.reason === "denied" ? "denied" : "unavailable";
  reject(new ScanQrError(reason, result.error));
}

function scanThroughShell(labels?: ScanQrLabels): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    nextId += 1;
    const id = `sq${Date.now().toString(36)}-${nextId}`;
    const onResult = (event: Event) => {
      const result = (event as CustomEvent<ScanQrResult>).detail;
      if (!result || result.id !== id) return;
      window.removeEventListener(SCAN_QR_RESULT_EVENT, onResult);
      settle(result, resolve, reject);
    };
    window.addEventListener(SCAN_QR_RESULT_EVENT, onResult);
    const message: ScanQrMessage = {
      type: SCAN_QR_MESSAGE,
      version: 1,
      id,
      ...(labels ? { labels } : {}),
    };
    if (!postToNativeShell(message)) {
      window.removeEventListener(SCAN_QR_RESULT_EVENT, onResult);
      reject(
        new ScanQrError(
          "unavailable",
          "The native shell could not be reached.",
        ),
      );
    }
  });
}

/**
 * Scan one QR code with the camera of the native shell the page runs in.
 *
 * Resolves with the code's text exactly as read, or `null` when the user
 * closed the scanner without one. Rejects with a {@link ScanQrError}:
 * `reason: "denied"` when the camera is not allowed (lead the user to
 * Settings, or to pasting), `"unavailable"` when there is no scanner here —
 * check {@link canScanQrCode} first so that never shows as a button.
 *
 * One scan at a time: a second call while the scanner is open gets the same
 * promise. Nothing times out; the scanner stays open as long as the user
 * leaves it open. The text is whatever the code held — validate it before use
 * (the storage module's `scanStorageCode` does, for pairing codes).
 */
export function scanQrCode(
  options: { labels?: ScanQrLabels } = {},
): Promise<string | null> {
  if (!canScanQrCode()) {
    return Promise.reject(new ScanQrError("unavailable"));
  }
  if (pending) return pending;
  const scan = scanThroughShell(options.labels);
  pending = scan;
  const clear = () => {
    if (pending === scan) pending = null;
  };
  scan.then(clear, clear);
  return scan;
}
