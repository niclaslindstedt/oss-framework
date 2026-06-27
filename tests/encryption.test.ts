// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it, vi } from "vitest";

import {
  decryptEnvelope,
  encryptText,
  isEncryptedEnvelope,
  parseEnvelope,
  type CryptoProgressStep,
} from "../src/encryption/crypto.ts";
import { withEncryption } from "../src/encryption/encrypting.ts";
import type {
  AdapterCapability,
  StorageAdapter,
  StoredSnapshot,
} from "../src/storage/adapter.ts";

const PASSWORD = "correct horse battery staple";

describe("envelope crypto", () => {
  it("round-trips plaintext through encrypt → decrypt", async () => {
    const text = "the quick brown fox 🦊";
    const envelope = await encryptText(text, PASSWORD);
    expect(envelope).not.toContain(text);
    expect(await decryptEnvelope(envelope, PASSWORD)).toBe(text);
  });

  it("produces a fresh salt + IV per encryption", async () => {
    const a = parseEnvelope(await encryptText("x", PASSWORD));
    const b = parseEnvelope(await encryptText("x", PASSWORD));
    expect(a && b).toBeTruthy();
    expect(a!.salt).not.toBe(b!.salt);
    expect(a!.iv).not.toBe(b!.iv);
  });

  it("rejects the wrong password with a clear error", async () => {
    const envelope = await encryptText("secret", PASSWORD);
    await expect(decryptEnvelope(envelope, "guess")).rejects.toThrow(
      "Wrong password",
    );
  });

  it("refuses to encrypt without a password", async () => {
    await expect(encryptText("secret", "")).rejects.toThrow(
      "Password is required",
    );
  });

  it("rejects non-envelope input on decrypt", async () => {
    await expect(decryptEnvelope("just plaintext", PASSWORD)).rejects.toThrow(
      "Not an encrypted envelope",
    );
  });

  it("sniffs envelopes vs plaintext", async () => {
    const envelope = await encryptText("hi", PASSWORD);
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(isEncryptedEnvelope("plain text")).toBe(false);
    expect(isEncryptedEnvelope("{not json")).toBe(false);
    expect(isEncryptedEnvelope(JSON.stringify({ foo: 1 }))).toBe(false);
    expect(parseEnvelope("nope")).toBeNull();
  });

  it("fires progress callbacks in order", async () => {
    const steps: CryptoProgressStep[] = [];
    const push = (s: CryptoProgressStep) => steps.push(s);
    const envelope = await encryptText("x", PASSWORD, push);
    expect(steps).toEqual(["derivingKey", "encrypting"]);
    steps.length = 0;
    await decryptEnvelope(envelope, PASSWORD, push);
    expect(steps).toEqual(["derivingKey", "decrypting"]);
  });
});

// A minimal in-memory adapter so the wrapper is exercised against bytes, not a
// live backend. Records the raw bytes it was handed so a test can assert they
// were enciphered.
function memoryAdapter(
  capabilities: AdapterCapability[] = [],
): StorageAdapter & { stored: StoredSnapshot | null } {
  const self = {
    id: "browser" as const,
    label: "Memory",
    capabilities: new Set<AdapterCapability>(capabilities),
    stored: null as StoredSnapshot | null,
    async load() {
      return this.stored;
    },
    async save(text: string) {
      this.stored = { text, revision: "r1" };
      return this.stored;
    },
  };
  return self;
}

describe("withEncryption", () => {
  it("encrypts on save and decrypts on load", async () => {
    const inner = memoryAdapter();
    const enc = withEncryption(inner, { current: PASSWORD });

    const written = await enc.save("hello world");
    // Caller sees the plaintext back; the inner backend holds an envelope.
    expect(written.text).toBe("hello world");
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
    expect(inner.stored!.text).not.toContain("hello world");

    const loaded = await enc.load();
    expect(loaded?.text).toBe("hello world");
  });

  it("passes plaintext through when no password is held (transition window)", async () => {
    const inner = memoryAdapter();
    const enc = withEncryption(inner, { current: null });
    await enc.save("not yet encrypted");
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(false);
    expect((await enc.load())?.text).toBe("not yet encrypted");
  });

  it("reads back plaintext leftovers even once a password is set", async () => {
    const inner = memoryAdapter();
    inner.stored = { text: "legacy plaintext", revision: "r0" };
    const enc = withEncryption(inner, { current: PASSWORD });
    expect((await enc.load())?.text).toBe("legacy plaintext");
  });

  it("throws when storage is encrypted but no password is held", async () => {
    const inner = memoryAdapter();
    await withEncryption(inner, { current: PASSWORD }).save("secret");
    const locked = withEncryption(inner, { current: null });
    await expect(locked.load()).rejects.toThrow(/password is required/i);
  });

  it("reflects a passphrase change through the live ref", async () => {
    const ref = { current: null as string | null };
    const inner = memoryAdapter();
    const enc = withEncryption(inner, ref);
    ref.current = PASSWORD;
    await enc.save("after unlock");
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
    expect((await enc.load())?.text).toBe("after unlock");
  });

  it("drops loadSync from the forwarded capabilities", () => {
    const inner = memoryAdapter(["loadSync", "watch", "probe"]);
    const caps = withEncryption(inner, { current: PASSWORD }).capabilities;
    expect(caps.has("loadSync")).toBe(false);
    expect(caps.has("watch")).toBe(true);
    expect(caps.has("probe")).toBe(true);
  });

  it("decrypts remote bytes delivered over watch", async () => {
    let emit: ((snap: StoredSnapshot) => void) | undefined;
    const inner: StorageAdapter = {
      id: "dropbox",
      label: "Watcher",
      capabilities: new Set<AdapterCapability>(["watch"]),
      async load() {
        return null;
      },
      async save(text) {
        return { text, revision: "r1" };
      },
      watch(onRemoteChange) {
        emit = onRemoteChange;
        return () => {};
      },
    };
    const enc = withEncryption(inner, { current: PASSWORD });
    const seen: string[] = [];
    enc.watch!((snap) => seen.push(snap.text));

    const envelope = await encryptText("pushed from another device", PASSWORD);
    emit!({ text: envelope, revision: "r2" });
    // The decrypt is async; let the microtask chain settle.
    await vi.waitFor(() =>
      expect(seen).toEqual(["pushed from another device"]),
    );
  });
});
