// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from "vitest";

import { ConflictError } from "../src/storage/adapter.ts";
import { createFileStoreAdapter } from "../src/storage/file-store-adapter.ts";
import type { FileEntry, FileStore } from "../src/storage/file-store.ts";

// An in-memory FileStore whose per-file revision bumps on every write, so the
// single-file binding's optimistic-concurrency path can be exercised without a
// real backend.
class MemoryFileStore implements FileStore {
  private files = new Map<string, { text: string; rev: number }>();
  listCalls = 0;

  async list(): Promise<FileEntry[]> {
    this.listCalls++;
    return [...this.files].map(([path, f]) => ({ path, rev: String(f.rev) }));
  }
  async read(path: string): Promise<string | null> {
    return this.files.get(path)?.text ?? null;
  }
  async write(path: string, text: string): Promise<void> {
    const rev = (this.files.get(path)?.rev ?? 0) + 1;
    this.files.set(path, { text, rev });
  }
  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
  // Simulate an out-of-band write from another device.
  external(path: string, text: string): void {
    const rev = (this.files.get(path)?.rev ?? 0) + 1;
    this.files.set(path, { text, rev });
  }
}

describe("createFileStoreAdapter", () => {
  let store: MemoryFileStore;

  beforeEach(() => {
    store = new MemoryFileStore();
  });

  const adapter = () =>
    createFileStoreAdapter(store, { id: "folder", label: "Mem" });

  it("returns null before anything is written", async () => {
    expect(await adapter().load()).toBeNull();
  });

  it("round-trips a saved document and tracks the revision", async () => {
    const a = adapter();
    const saved = await a.save("hello");
    expect(saved.text).toBe("hello");
    expect(saved.revision).toBeDefined();

    const loaded = await a.load();
    expect(loaded?.text).toBe("hello");
    expect(loaded?.revision).toBe(saved.revision);
  });

  it("stores under the configured fileName", async () => {
    const a = createFileStoreAdapter(store, {
      id: "folder",
      label: "Mem",
      fileName: "notes.json",
    });
    await a.save("x");
    expect(await store.read("notes.json")).toBe("x");
    expect(await store.read("document.json")).toBeNull();
  });

  it("saves without baseRevision overwrite-blind", async () => {
    const a = adapter();
    await a.save("v1");
    const second = await a.save("v2");
    expect((await a.load())?.text).toBe("v2");
    expect(second.text).toBe("v2");
  });

  it("throws ConflictError carrying remote bytes when the revision moved", async () => {
    const a = adapter();
    const first = await a.save("mine");
    // Another device writes in between.
    store.external("document.json", "theirs");

    await expect(a.save("mine again", first.revision)).rejects.toBeInstanceOf(
      ConflictError,
    );
    try {
      await a.save("mine again", first.revision);
    } catch (err) {
      expect((err as ConflictError).remote.text).toBe("theirs");
    }
  });

  it("does not conflict when the base revision still matches", async () => {
    const a = adapter();
    const first = await a.save("v1");
    const second = await a.save("v2", first.revision);
    expect(second.text).toBe("v2");
  });

  it("getRevision reports null then the live revision", async () => {
    const a = adapter();
    expect(await a.getRevision?.()).toBeNull();
    const saved = await a.save("doc");
    expect(await a.getRevision?.()).toBe(saved.revision);
  });

  it("probes reachable", async () => {
    expect(await adapter().probe?.()).toBe(true);
  });

  it("advertises probe + getRevision capabilities", () => {
    const caps = adapter().capabilities;
    expect(caps.has("probe")).toBe(true);
    expect(caps.has("getRevision")).toBe(true);
  });
});

describe("createFileStoreAdapter retry", () => {
  it("retries a transient network error then succeeds", async () => {
    let listAttempts = 0;
    const flaky: FileStore = {
      async list() {
        listAttempts++;
        if (listAttempts === 1) throw new TypeError("Failed to fetch");
        return [];
      },
      async read() {
        return null;
      },
      async write() {},
      async remove() {},
    };
    const a = createFileStoreAdapter(flaky, {
      id: "dropbox",
      label: "Flaky",
      retryDelaysMs: [1],
    });
    expect(await a.load()).toBeNull();
    expect(listAttempts).toBe(2);
  });
});
