// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from "vitest";

import {
  AuthError,
  ConflictError,
  RateLimitError,
  type StorageAdapter,
  type StoredSnapshot,
} from "../src/storage/adapter.ts";
import {
  describeStorageError,
  isOfflineError,
  localCacheKey,
  withLocalCache,
} from "../src/storage/cache/index.ts";

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

// A controllable inner adapter whose load/save can be told to fail offline.
// `box` is shared with the test so it can prime the remote or flip offline.
type InnerBox = { remote: StoredSnapshot | null; offline: boolean };
function makeInner(): { adapter: StorageAdapter; box: InnerBox } {
  const box: InnerBox = { remote: null, offline: false };
  const adapter: StorageAdapter = {
    id: "dropbox",
    label: "Inner",
    capabilities: new Set(["probe"]),
    async load() {
      if (box.offline) throw new TypeError("Failed to fetch");
      return box.remote;
    },
    async save(text) {
      if (box.offline) throw new TypeError("Failed to fetch");
      box.remote = { text, revision: "r1" };
      return box.remote;
    },
    async probe() {
      return !box.offline;
    },
  };
  return { adapter, box };
}

describe("isOfflineError", () => {
  it("treats a bare TypeError as offline", () => {
    expect(isOfflineError(new TypeError("Load failed"))).toBe(true);
  });
  it("never treats typed signals as offline", () => {
    expect(isOfflineError(new ConflictError({ text: "" }))).toBe(false);
    expect(isOfflineError(new AuthError("nope"))).toBe(false);
    expect(isOfflineError(new RateLimitError(1000))).toBe(false);
  });
});

describe("describeStorageError", () => {
  it("rewrites a network failure into a plain phrase", () => {
    expect(describeStorageError(new TypeError("Failed to fetch"))).toContain(
      "backend unreachable",
    );
  });
  it("passes a descriptive error through verbatim", () => {
    expect(describeStorageError(new Error("Dropbox upload failed: 503"))).toBe(
      "Dropbox upload failed: 503",
    );
  });
});

describe("localCacheKey", () => {
  it("namespaces by backend and scope", () => {
    expect(localCacheKey("dropbox", "main")).toBe("oss:cache:dropbox:main");
  });
});

describe("withLocalCache", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  const wrap = (inner: StorageAdapter) =>
    withLocalCache(inner, { storage, key: "oss:cache:dropbox:main" });

  it("mirrors a successful load and serves it synchronously next time", async () => {
    const { adapter, box } = makeInner();
    box.remote = { text: "doc", revision: "r1" };
    const cached = wrap(adapter);
    await cached.load();
    expect(cached.loadSync?.()?.text).toBe("doc");
    expect(cached.capabilities.has("loadSync")).toBe(true);
  });

  it("serves the cached copy with offline flag when the backend is offline", async () => {
    const { adapter, box } = makeInner();
    box.remote = { text: "doc", revision: "r1" };
    const cached = wrap(adapter);
    await cached.load(); // primes the mirror
    box.offline = true;
    const offlineLoad = await cached.load();
    expect(offlineLoad?.text).toBe("doc");
    expect(offlineLoad?.offline).toBe(true);
  });

  it("rethrows offline load when nothing is cached", async () => {
    const { adapter, box } = makeInner();
    box.offline = true;
    await expect(wrap(adapter).load()).rejects.toBeInstanceOf(TypeError);
  });

  it("caches the attempted bytes on an offline save and rethrows", async () => {
    const { adapter, box } = makeInner();
    const cached = wrap(adapter);
    box.offline = true;
    await expect(cached.save("queued")).rejects.toBeInstanceOf(TypeError);
    // The attempted bytes survive for an offline reload.
    expect(cached.loadSync?.()?.text).toBe("queued");
  });

  it("clears a stale mirror when the remote is now empty", async () => {
    const { adapter, box } = makeInner();
    box.remote = { text: "doc", revision: "r1" };
    const cached = wrap(adapter);
    await cached.load();
    box.remote = null;
    expect(await cached.load()).toBeNull();
    expect(cached.loadSync?.()).toBeNull();
  });
});
