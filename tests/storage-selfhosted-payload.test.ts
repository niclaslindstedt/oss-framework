// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { formatStoragePayload, parseStoragePayload, StoragePayloadError } from "../src/storage/index.ts";

describe("pairing and invite payloads", () => {
  it("parses the server's pairing URI", () => {
    const uri = "oss-storage://pair?v=1&s=https%3A%2F%2Fhome.example%3A8443&c=Q2hhbGxlbmdlLWNvZGUtMzItYnl0ZXMtYmFzZTY0dXJs&n=home&fp=abc";
    expect(parseStoragePayload(uri)).toEqual({
      kind: "pair",
      server: "https://home.example:8443",
      code: "Q2hhbGxlbmdlLWNvZGUtMzItYnl0ZXMtYmFzZTY0dXJs",
      name: "home",
      fp: "abc",
    });
  });

  it("round-trips device pairing and invites, bare and as app links", () => {
    const secret = new Uint8Array(32).fill(7);
    for (const appUrl of [undefined, "https://meds.example/app/"]) {
      const pair = formatStoragePayload({ kind: "pair", server: "https://h.example", secret }, appUrl);
      expect(parseStoragePayload(pair)).toEqual({ kind: "pair", server: "https://h.example", secret });
      const invite = formatStoragePayload({ kind: "invite", server: "https://h.example", secret, role: "viewer" }, appUrl);
      expect(parseStoragePayload(invite)).toEqual({ kind: "invite", server: "https://h.example", secret, role: "viewer" });
    }
    expect(formatStoragePayload({ kind: "invite", server: "https://h.example", secret }, "https://a.example/")).toMatch(/^https:\/\/a\.example\/#oss=/);
  });

  it("rejects garbage with a readable message", () => {
    expect(() => parseStoragePayload("hello")).toThrow(StoragePayloadError);
    expect(() => parseStoragePayload("oss-storage://pair?v=2&s=https%3A%2F%2Fa&c=x")).toThrow(/newer app/);
    expect(() => parseStoragePayload("oss-storage://pair?v=1&s=ftp%3A%2F%2Fa&c=x")).toThrow(/http/);
    expect(() => parseStoragePayload("oss-storage://invite?v=1&s=https%3A%2F%2Fa")).toThrow(/secret/);
    expect(() => parseStoragePayload("oss-storage://invite?v=1&s=https%3A%2F%2Fa&x=AAAA")).toThrow(/damaged/);
    expect(() => parseStoragePayload("https://app.example/#oss=!!!")).toThrow(StoragePayloadError);
  });
});
