// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canScanQrCode,
  SCAN_QR_MESSAGE,
  SCAN_QR_RESULT_EVENT,
  scanQrCode,
  ScanQrError,
  type ScanQrMessage,
  type ScanQrResult,
} from "../src/qr/index.ts";
import {
  formatStoragePayload,
  scanStorageCode,
  StoragePayloadError,
} from "../src/storage/index.ts";

type Answer =
  | { ok: true; text: string | null }
  | { ok: false; reason: string; error?: string }
  | Record<string, unknown>;

let posted: ScanQrMessage[] = [];

afterEach(() => {
  posted = [];
  vi.unstubAllGlobals();
});

/** Stand in for an Expo shell: the react-native-webview bridge, and (unless
 *  told otherwise) a descriptor advertising the contract. The shell answers
 *  later, through injectJavaScript, with `answer` — or never, when there is
 *  none. */
function stubShell({
  capabilities = ["scan-qr"],
  answer,
  bridge = true,
}: {
  capabilities?: string[];
  answer?: (message: ScanQrMessage) => Answer;
  bridge?: boolean | "throws";
} = {}) {
  vi.stubGlobal("__ossShell", { version: 1, capabilities });
  if (!bridge) return;
  vi.stubGlobal("ReactNativeWebView", {
    postMessage: (data: string) => {
      if (bridge === "throws") throw new Error("gone");
      const message = JSON.parse(data) as ScanQrMessage;
      posted.push(message);
      if (!answer) return;
      const detail = { id: message.id, ...answer(message) };
      setTimeout(() => dispatch(detail));
    },
  });
}

function dispatch(detail: unknown) {
  window.dispatchEvent(new CustomEvent(SCAN_QR_RESULT_EVENT, { detail }));
}

const PAIRING = formatStoragePayload({
  kind: "pair",
  server: "https://home.example:8443",
  code: "Q2hhbGxlbmdlLWNvZGUtMzItYnl0ZXMtYmFzZTY0dXJs",
});
const PAIRING_LINK = formatStoragePayload(
  { kind: "pair", server: "https://home.example", secret: new Uint8Array(32) },
  "https://app.example/",
);
const INVITE = formatStoragePayload({
  kind: "invite",
  server: "https://home.example",
  secret: new Uint8Array(32).fill(3),
});

describe("canScanQrCode", () => {
  it("is false in a browser tab", () => {
    expect(canScanQrCode()).toBe(false);
  });

  it("is false in a shell that has not advertised the contract", () => {
    stubShell({ capabilities: ["save-file"] });
    expect(canScanQrCode()).toBe(false);
  });

  it("is false when the descriptor advertises it but there is no bridge", () => {
    stubShell({ bridge: false });
    expect(canScanQrCode()).toBe(false);
  });

  it("is true in a shell that advertises scan-qr", () => {
    stubShell();
    expect(canScanQrCode()).toBe(true);
  });
});

describe("scanQrCode", () => {
  it("rejects as unavailable, posting nothing, where it cannot scan", async () => {
    stubShell({ capabilities: [] });
    const error = await scanQrCode().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScanQrError);
    expect((error as ScanQrError).reason).toBe("unavailable");
    expect(posted).toHaveLength(0);
  });

  it("asks the shell to scan and resolves with the text as read", async () => {
    stubShell({ answer: () => ({ ok: true, text: " hello " }) });
    await expect(scanQrCode()).resolves.toBe(" hello ");
    expect(posted).toHaveLength(1);
    const [message] = posted;
    expect(message!.type).toBe(SCAN_QR_MESSAGE);
    expect(message!.version).toBe(1);
    expect(typeof message!.id).toBe("string");
    expect(message!).not.toHaveProperty("labels");
  });

  it("passes the page's words to the scanner", async () => {
    stubShell({ answer: () => ({ ok: true, text: "x" }) });
    const labels = { hint: "Rikta kameran mot koden", cancel: "Avbryt" };
    await scanQrCode({ labels });
    expect(posted[0]!.labels).toEqual(labels);
  });

  it("resolves null when the user cancels", async () => {
    stubShell({ answer: () => ({ ok: true, text: null }) });
    await expect(scanQrCode()).resolves.toBeNull();
  });

  it("rejects as denied when the camera is not allowed", async () => {
    stubShell({
      answer: () => ({
        ok: false,
        reason: "denied",
        error: "No camera access",
      }),
    });
    const error = await scanQrCode().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScanQrError);
    expect((error as ScanQrError).reason).toBe("denied");
    expect((error as ScanQrError).message).toBe("No camera access");
  });

  it("reads an unknown failure, or a malformed answer, as unavailable", async () => {
    stubShell({ answer: () => ({ ok: false, reason: "on-fire" }) });
    await expect(scanQrCode()).rejects.toMatchObject({ reason: "unavailable" });
    vi.unstubAllGlobals();
    stubShell({ answer: () => ({ ok: true, text: 42 }) });
    await expect(scanQrCode()).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("rejects as unavailable when the bridge throws", async () => {
    stubShell({ bridge: "throws" });
    await expect(scanQrCode()).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("settles only on its own answer", async () => {
    stubShell();
    const scan = scanQrCode();
    const id = posted[0]!.id;
    dispatch({ id: "someone-else", ok: true, text: "not mine" });
    dispatch(null);
    const answer: ScanQrResult = { id, ok: true, text: "mine" };
    dispatch(answer);
    await expect(scan).resolves.toBe("mine");
  });

  it("opens one scanner for a double tap, and a new one afterwards", async () => {
    stubShell();
    const first = scanQrCode();
    const second = scanQrCode();
    expect(second).toBe(first);
    expect(posted).toHaveLength(1);
    dispatch({ id: posted[0]!.id, ok: true, text: null });
    await first;
    const third = scanQrCode();
    expect(third).not.toBe(first);
    expect(posted).toHaveLength(2);
    dispatch({ id: posted[1]!.id, ok: true, text: "again" });
    await expect(third).resolves.toBe("again");
  });
});

describe("scanStorageCode", () => {
  it("returns a scanned pairing URI, trimmed, for the paste path", async () => {
    stubShell({ answer: () => ({ ok: true, text: `  ${PAIRING}\n` }) });
    await expect(scanStorageCode()).resolves.toBe(PAIRING);
  });

  it("accepts an #oss= app link", async () => {
    stubShell({ answer: () => ({ ok: true, text: PAIRING_LINK }) });
    await expect(scanStorageCode()).resolves.toBe(PAIRING_LINK);
  });

  it("resolves null when the user cancels", async () => {
    stubShell({ answer: () => ({ ok: true, text: null }) });
    await expect(scanStorageCode()).resolves.toBeNull();
  });

  it("refuses a code that is not a storage code", async () => {
    stubShell({ answer: () => ({ ok: true, text: "https://example.com/" }) });
    await expect(scanStorageCode()).rejects.toBeInstanceOf(StoragePayloadError);
  });

  it("refuses a damaged app link", async () => {
    stubShell({
      answer: () => ({ ok: true, text: "https://app.example/#oss=!!!" }),
    });
    await expect(scanStorageCode()).rejects.toBeInstanceOf(StoragePayloadError);
  });

  it("refuses an invite on a pairing screen, and the reverse", async () => {
    stubShell({ answer: () => ({ ok: true, text: INVITE }) });
    await expect(scanStorageCode()).rejects.toThrow(/invite, not a pairing/);
    await expect(scanStorageCode({ kind: "invite" })).resolves.toBe(INVITE);
    vi.unstubAllGlobals();
    stubShell({ answer: () => ({ ok: true, text: PAIRING }) });
    await expect(scanStorageCode({ kind: "invite" })).rejects.toThrow(
      /pairing code, not an invite/,
    );
  });

  it("passes the page's words, and the camera's refusal, through", async () => {
    stubShell({ answer: () => ({ ok: false, reason: "denied" }) });
    const error = await scanStorageCode({ labels: { cancel: "Avbryt" } }).catch(
      (e: unknown) => e,
    );
    expect(posted[0]!.labels).toEqual({ cancel: "Avbryt" });
    expect(error).toBeInstanceOf(ScanQrError);
    expect((error as ScanQrError).reason).toBe("denied");
  });
});
