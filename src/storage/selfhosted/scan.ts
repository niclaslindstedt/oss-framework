// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scan a pairing or invite code in the app, instead of pasting it.
//
// `scanQrCode` (the qr module) reads whatever QR code the camera sees. This is
// the step between that and `client.pair` / `client.acceptInvite`: the text
// must be a storage code (a bare `oss-storage://…` URI, or an app link that
// carries one after `#oss=`) of the kind the screen asked for, before the app
// shows it anywhere or sends a byte to a server. It returns the text as read —
// the same string a paste gives — so a scan and a paste take one path from
// here on. Nothing is kept: the code is a one-time secret.

import { scanQrCode, type ScanQrLabels } from "../../qr/scan.ts";
import { parsePayload, PayloadError, type Payload } from "./payload.ts";

/**
 * Scan a storage code with the native shell's camera.
 *
 * Resolves with the scanned text, or `null` when the user closed the scanner.
 * Rejects with a `StoragePayloadError` when the code is not a storage code, or
 * not of `kind` (`"pair"` by default — a pairing screen that is handed an
 * invite says so rather than failing later), and with the qr module's
 * `ScanQrError` when the camera is denied or there is no scanner. Show the
 * Scan button only where `canScanQrCode()` is true; keep the paste field.
 */
export async function scanStorageCode(
  options: { kind?: Payload["kind"]; labels?: ScanQrLabels } = {},
): Promise<string | null> {
  const kind = options.kind ?? "pair";
  const text = await scanQrCode(
    options.labels ? { labels: options.labels } : {},
  );
  if (text === null) return null;
  const code = text.trim();
  const payload = parsePayload(code);
  if (payload.kind !== kind) {
    throw new PayloadError(
      payload.kind === "invite"
        ? "that is an invite, not a pairing code"
        : "that is a pairing code, not an invite",
    );
  }
  return code;
}
