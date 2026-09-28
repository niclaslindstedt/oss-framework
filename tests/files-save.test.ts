// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SAVE_FILE_MESSAGE,
  SAVE_FILE_RESULT_EVENT,
  saveFile,
  type SaveFileMessage,
  type SaveFileResult,
} from "../src/files/index.ts";
import { nativeShellCan } from "../src/pwa/index.ts";

// jsdom has no object URLs and no real anchor navigation, so the web path is
// asserted at that boundary; the shell path at the bridge.
let downloads: { download: string; blob: Blob }[];
let posted: SaveFileMessage[];

beforeEach(() => {
  downloads = [];
  posted = [];
  let current: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    current = blob;
    return "blob:mock";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ download: this.download, blob: current! });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Stand in for an Expo shell: the react-native-webview bridge, and (unless
 *  told otherwise) a descriptor advertising the contract. */
function stubShell({
  capabilities = ["save-file"],
  answer,
}: {
  capabilities?: string[];
  answer?: (message: SaveFileMessage) => Omit<SaveFileResult, "id">;
} = {}) {
  vi.stubGlobal("__ossShell", { version: 1, capabilities });
  vi.stubGlobal("ReactNativeWebView", {
    postMessage: (data: string) => {
      const message = JSON.parse(data) as SaveFileMessage;
      posted.push(message);
      if (!answer) return;
      // The shell answers later, through injectJavaScript.
      const detail = { id: message.id, ...answer(message) };
      setTimeout(() =>
        window.dispatchEvent(
          new CustomEvent(SAVE_FILE_RESULT_EVENT, { detail }),
        ),
      );
    },
  });
}

function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

describe("saveFile on the web", () => {
  it("downloads a blob under its name", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await expect(saveFile({ blob, filename: "a.png" })).resolves.toBe(
      "downloaded",
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.download).toBe("a.png");
    expect(downloads[0]!.blob).toBe(blob);
  });

  it("downloads text as a typed document", async () => {
    await saveFile({ text: "a,b", filename: "t.csv", mimeType: "text/csv" });
    expect(downloads[0]!.blob.type).toBe("text/csv");
    expect(await downloads[0]!.blob.text()).toBe("a,b");
  });

  it("keeps a directory and control characters out of the name", async () => {
    await saveFile({ text: "x", filename: "../../etc/pass\u0000wd\n" });
    expect(downloads[0]!.download).toBe(".._.._etc_passwd");
  });

  it("stays a download in a WebView whose shell did not advertise it", async () => {
    stubShell({ capabilities: [] });
    expect(nativeShellCan("save-file")).toBe(false);
    await expect(saveFile({ text: "x", filename: "x.txt" })).resolves.toBe(
      "downloaded",
    );
    expect(posted).toHaveLength(0);
  });
});

describe("saveFile in a native shell", () => {
  it("sends the bytes to the shell and resolves when it reports", async () => {
    stubShell({ answer: () => ({ ok: true }) });
    const bytes = new Uint8Array([0, 255, 128, 7]);
    const outcome = saveFile({
      blob: new Blob([bytes], { type: "image/png" }),
      filename: "drawing.png",
    });
    await expect(outcome).resolves.toBe("shared");
    expect(downloads).toHaveLength(0);
    expect(posted).toHaveLength(1);
    const message = posted[0]!;
    expect(message.type).toBe(SAVE_FILE_MESSAGE);
    expect(message.version).toBe(1);
    expect(message.filename).toBe("drawing.png");
    expect(message.mimeType).toBe("image/png");
    expect(Array.from(decode(message.base64))).toEqual(Array.from(bytes));
  });

  it("encodes text as UTF-8 and drops MIME parameters", async () => {
    stubShell({ answer: () => ({ ok: true }) });
    await saveFile({
      text: "åäö €",
      filename: "notes.csv",
      mimeType: "text/csv;charset=utf-8",
    });
    const message = posted[0]!;
    expect(message.mimeType).toBe("text/csv");
    expect(new TextDecoder().decode(decode(message.base64))).toBe("åäö €");
  });

  it("rejects with the shell's error", async () => {
    stubShell({ answer: () => ({ ok: false, error: "disk full" }) });
    await expect(saveFile({ text: "x", filename: "x.txt" })).rejects.toThrow(
      "disk full",
    );
  });

  it("settles each request by its own id", async () => {
    stubShell();
    const first = saveFile({ text: "1", filename: "1.txt" });
    const second = saveFile({ text: "2", filename: "2.txt" });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    const [a, b] = posted;
    expect(a!.id).not.toBe(b!.id);
    window.dispatchEvent(
      new CustomEvent(SAVE_FILE_RESULT_EVENT, {
        detail: { id: b!.id, ok: false, error: "no" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(SAVE_FILE_RESULT_EVENT, {
        detail: { id: a!.id, ok: true },
      }),
    );
    await expect(first).resolves.toBe("shared");
    await expect(second).rejects.toThrow("no");
  });

  it("rejects when the bridge throws", async () => {
    vi.stubGlobal("__ossShell", { version: 1, capabilities: ["save-file"] });
    vi.stubGlobal("ReactNativeWebView", {
      postMessage: () => {
        throw new Error("gone");
      },
    });
    await expect(saveFile({ text: "x", filename: "x.txt" })).rejects.toThrow(
      "could not be reached",
    );
  });
});
