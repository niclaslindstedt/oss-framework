// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MIME_JSON,
  bytesToDataUrl,
  dataUrlToBlob,
  dataUrlToBytes,
  downloadBlob,
  downloadText,
  openBlobInTab,
  openDataUrlInTab,
  readFileAsDataUrl,
  readFilesWithLimit,
  saveDataUrl,
} from "../src/files/index.ts";

// jsdom implements neither object URLs nor a real window.open, so the
// download/open tests stub the boundary and assert what crossed it.
let createdBlobs: Blob[];
let clickedAnchors: { href: string; download: string }[];

beforeEach(() => {
  createdBlobs = [];
  clickedAnchors = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    createdBlobs.push(blob);
    return `blob:mock-${createdBlobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchors.push({ href: this.href, download: this.download });
  });
  window.open = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("data URL <-> bytes codec", () => {
  it("round-trips bytes through a base64 data URL", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 128, 255]);
    const url = bytesToDataUrl("image/jpeg", bytes);
    expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
    const back = dataUrlToBytes(url);
    expect(back?.mime).toBe("image/jpeg");
    expect(Array.from(back!.bytes)).toEqual(Array.from(bytes));
  });

  it("returns null for a non-base64 / non-data string", () => {
    expect(dataUrlToBytes("https://example.com/a.png")).toBeNull();
    expect(dataUrlToBytes(undefined)).toBeNull();
    expect(dataUrlToBytes("data:image/png,notbase64")).toBeNull();
  });

  it("chunks a large payload without corrupting it", () => {
    const bytes = new Uint8Array(0x8000 * 2 + 17);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 256;
    const back = dataUrlToBytes(bytesToDataUrl("application/zip", bytes));
    expect(back?.bytes.length).toBe(bytes.length);
    expect(back?.bytes[0x8000 * 2 + 16]).toBe((0x8000 * 2 + 16) % 256);
  });
});

describe("dataUrlToBlob", () => {
  it("builds a Blob tagged with the embedded MIME type", async () => {
    const url = bytesToDataUrl("application/pdf", new Uint8Array([1, 2, 3]));
    const blob = dataUrlToBlob(url);
    expect(blob?.type).toBe("application/pdf");
    expect(blob?.size).toBe(3);
  });

  it("prefers an explicit MIME override", () => {
    const url = bytesToDataUrl("application/octet-stream", new Uint8Array(2));
    expect(dataUrlToBlob(url, "application/pdf")?.type).toBe("application/pdf");
  });

  it("returns null when the payload isn't a base64 data URL", () => {
    expect(dataUrlToBlob("https://example.com/a.pdf")).toBeNull();
    expect(dataUrlToBlob(undefined)).toBeNull();
  });
});

describe("download", () => {
  it("saves text through a transient anchor with the given MIME type", async () => {
    downloadText("export.json", '{"a":1}', MIME_JSON);
    expect(clickedAnchors).toEqual([
      { href: "blob:mock-1", download: "export.json" },
    ]);
    expect(createdBlobs[0]!.type).toBe(MIME_JSON);
    expect(await createdBlobs[0]!.text()).toBe('{"a":1}');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
    // The anchor was removed again.
    expect(document.querySelector("a")).toBeNull();
  });

  it("saves a Blob under the given filename", () => {
    downloadBlob("bytes.bin", new Blob([new Uint8Array([1, 2])]));
    expect(clickedAnchors[0]?.download).toBe("bytes.bin");
  });
});

describe("open in tab", () => {
  it("opens a Blob via an object URL and revokes it after the grace period", () => {
    vi.useFakeTimers();
    openBlobInTab(new Blob(["x"], { type: "application/pdf" }));
    expect(window.open).toHaveBeenCalledWith(
      "blob:mock-1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
  });

  it("opens a stored data URL as a typed Blob", () => {
    const url = bytesToDataUrl("application/pdf", new Uint8Array([1]));
    expect(openDataUrlInTab(url)).toBe(true);
    expect(createdBlobs[0]!.type).toBe("application/pdf");
    expect(window.open).toHaveBeenCalled();
  });

  it("reports failure for an undecodable payload instead of opening", () => {
    expect(openDataUrlInTab("nope")).toBe(false);
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe("saveDataUrl", () => {
  it("saves a stored data URL to disk under the given filename", () => {
    const url = bytesToDataUrl("application/zip", new Uint8Array([1, 2, 3]));
    expect(saveDataUrl("archive.zip", url)).toBe(true);
    expect(clickedAnchors[0]?.download).toBe("archive.zip");
    expect(createdBlobs[0]!.type).toBe("application/zip");
  });

  it("reports failure for an undecodable payload", () => {
    expect(saveDataUrl("x.bin", "not-a-data-url")).toBe(false);
    expect(clickedAnchors).toHaveLength(0);
  });
});

describe("intake", () => {
  it("reads one file to a base64 data URL, byte for byte", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "a.bin", {
      type: "application/octet-stream",
    });
    const dataUrl = await readFileAsDataUrl(file);
    expect(dataUrl).toBe("data:application/octet-stream;base64,AQID");
  });

  it("partitions a batch into accepted and rejected by the byte cap", async () => {
    const small = new File([new Uint8Array([1, 2, 3])], "small.bin", {
      type: "application/pdf",
    });
    const big = new File([new Uint8Array(2048)], "big.bin", {
      type: "application/pdf",
    });
    const { accepted, rejected } = await readFilesWithLimit([small, big], {
      maxBytes: 1024,
    });
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      name: "small.bin",
      type: "application/pdf",
      size: 3,
    });
    expect(dataUrlToBytes(accepted[0]!.dataUrl)?.bytes).toHaveLength(3);
    expect(rejected).toEqual([
      { name: "big.bin", size: 2048, reason: "too-large" },
    ]);
  });

  it("accepts any size when no cap is given", async () => {
    const big = new File([new Uint8Array(2048)], "big.bin");
    const { accepted, rejected } = await readFilesWithLimit([big]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("falls back to a generic name and MIME type", async () => {
    const file = new File([new Uint8Array([1])], "");
    const { accepted } = await readFilesWithLimit([file]);
    expect(accepted[0]).toMatchObject({
      name: "file",
      type: "application/octet-stream",
    });
  });

  it("rejects a file the browser can't read as read-failed", async () => {
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(
      function (this: FileReader) {
        setTimeout(() =>
          this.onerror?.call(
            this,
            new ProgressEvent("error") as ProgressEvent<FileReader>,
          ),
        );
      },
    );
    const file = new File([new Uint8Array([1, 2])], "broken.bin");
    const { accepted, rejected } = await readFilesWithLimit([file]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual([
      { name: "broken.bin", size: 2, reason: "read-failed" },
    ]);
  });
});
