// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from "vitest";

import {
  BrowserLocalStorageAdapter,
  deleteLocalDocument,
} from "../src/storage/local/index.ts";

// Minimal in-memory `Storage` so the adapter never touches the real
// `localStorage` (and tests stay isolated from one another).
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("BrowserLocalStorageAdapter", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("loadSync returns null on first run", () => {
    const a = new BrowserLocalStorageAdapter({ storage, key: "k" });
    expect(a.loadSync()).toBeNull();
  });

  it("saves and reads back synchronously and async", async () => {
    const a = new BrowserLocalStorageAdapter({ storage, key: "k" });
    await a.save("payload");
    expect(a.loadSync()?.text).toBe("payload");
    expect((await a.load())?.text).toBe("payload");
  });

  it("advertises the loadSync capability", () => {
    const a = new BrowserLocalStorageAdapter({ storage });
    expect(a.capabilities.has("loadSync")).toBe(true);
  });

  it("keeps distinct keys independent", async () => {
    await new BrowserLocalStorageAdapter({ storage, key: "a" }).save("A");
    await new BrowserLocalStorageAdapter({ storage, key: "b" }).save("B");
    expect(
      new BrowserLocalStorageAdapter({ storage, key: "a" }).loadSync()?.text,
    ).toBe("A");
    expect(
      new BrowserLocalStorageAdapter({ storage, key: "b" }).loadSync()?.text,
    ).toBe("B");
  });

  it("rethrows a failed write (e.g. quota exceeded)", async () => {
    const boom: Storage = {
      ...storage,
      setItem() {
        throw new Error("QuotaExceeded");
      },
    } as unknown as Storage;
    const a = new BrowserLocalStorageAdapter({ storage: boom, key: "k" });
    await expect(a.save("x")).rejects.toThrow("QuotaExceeded");
  });

  it("deleteLocalDocument removes the document", async () => {
    const a = new BrowserLocalStorageAdapter({ storage, key: "k" });
    await a.save("gone soon");
    deleteLocalDocument("k", storage);
    expect(a.loadSync()).toBeNull();
  });
});
