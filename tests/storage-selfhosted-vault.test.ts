// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import {
  createHostKeyVault,
  createIndexedDbKeyVault,
  createMemoryKeyVault,
  defaultKeyVault,
  getKeyVaultHost,
  KEY_VAULT_HOST_PROPERTY,
  type KeyVaultHost,
} from "../src/storage/index.ts";
import { installFakeIndexedDb, removeIndexedDb } from "./stubs/indexeddb.ts";

afterEach(() => {
  removeIndexedDb();
  delete (globalThis as Record<string, unknown>).window;
});

async function aesKey(extractable = false) {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, extractable, ["encrypt", "decrypt"]);
}

describe("key vaults", () => {
  it("memory vault stores CryptoKeys and clears by prefix", async () => {
    const v = createMemoryKeyVault();
    const k = await aesKey();
    await v.put("ns:a:1:content", k);
    await v.put("ns:b:1:content", k);
    await v.put("session", new Uint8Array([1]));
    expect(await v.get("ns:a:1:content")).toBe(k);
    await v.clear("ns:a:");
    expect(await v.get("ns:a:1:content")).toBeNull();
    expect(await v.get("ns:b:1:content")).toBe(k);
    await v.clear();
    expect(await v.get("session")).toBeNull();
  });

  it("IndexedDB vault keeps keys non-extractable at rest", async () => {
    installFakeIndexedDb();
    const v = createIndexedDbKeyVault({ name: "test" });
    const k = await aesKey(false);
    await v.put("k", k);
    const back = (await v.get("k")) as CryptoKey;
    expect(back.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", back)).rejects.toThrow();
    await v.delete("k");
    expect(await v.get("k")).toBeNull();
  });

  it("native host vault stores bytes through the bridge", async () => {
    const map = new Map<string, string>();
    const host: KeyVaultHost = {
      version: 1,
      get: async (id) => map.get(id) ?? null,
      put: async (id, v) => void map.set(id, v),
      delete: async (id) => void map.delete(id),
      clear: async (p) => {
        for (const k of [...map.keys()]) if (k.startsWith(p)) map.delete(k);
      },
    };
    (globalThis as Record<string, unknown>).window = { [KEY_VAULT_HOST_PROPERTY]: host };
    expect(getKeyVaultHost()).toBe(host);
    const v = defaultKeyVault("app");
    expect(v.kind).toBe("bytes");
    await v.put("x", new Uint8Array([1, 2, 255]));
    expect([...((await v.get("x")) as Uint8Array)]).toEqual([1, 2, 255]);
    await expect(v.put("y", await aesKey())).rejects.toThrow(/bytes/);
    expect(createHostKeyVault(host).kind).toBe("bytes");
  });

  it("ignores a malformed host", () => {
    (globalThis as Record<string, unknown>).window = { [KEY_VAULT_HOST_PROPERTY]: { version: 2 } };
    expect(getKeyVaultHost()).toBeNull();
  });
});
