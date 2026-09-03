// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createIdbStore } from "../src/storage/index.ts";
import { installFakeIndexedDb, removeIndexedDb } from "./stubs/indexeddb.ts";

type Tape = { slug: string; text: string };

afterEach(() => removeIndexedDb());

describe("createIdbStore", () => {
  beforeEach(() => installFakeIndexedDb());

  it("round-trips a record by key", async () => {
    const store = createIdbStore<string>({
      dbName: "test:tapes",
      storeName: "tapes",
    });
    expect(await store.get("work")).toBeNull();
    await store.set("work", "# a tape");
    expect(await store.get("work")).toBe("# a tape");
  });

  it("replaces rather than appends on a second write", async () => {
    const store = createIdbStore<string>({
      dbName: "test:tapes",
      storeName: "tapes",
    });
    await store.set("work", "first");
    await store.set("work", "second");
    expect(await store.get("work")).toBe("second");
    expect(await store.keys()).toEqual(["work"]);
  });

  it("forgets a record, and empties the store", async () => {
    const store = createIdbStore<string>({
      dbName: "test:tapes",
      storeName: "tapes",
    });
    await store.set("a", "1");
    await store.set("b", "2");
    await store.delete("a");
    expect(await store.keys()).toEqual(["b"]);
    await store.clear();
    expect(await store.getAll()).toEqual([]);
  });

  it("writes and drops many in one go", async () => {
    const store = createIdbStore<string>({
      dbName: "test:batch",
      storeName: "records",
    });
    await store.setMany([
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ]);
    expect(await store.getAll()).toEqual(["1", "2", "3"]);
    await store.deleteMany(["a", "c"]);
    expect(await store.keys()).toEqual(["b"]);
  });

  it("reads a subset through a declared index", async () => {
    const store = createIdbStore<Tape>({
      dbName: "test:indexed",
      storeName: "tapes",
      indexes: { slug: "slug" },
    });
    await store.setMany([
      ["work:1", { slug: "work", text: "one" }],
      ["home:1", { slug: "home", text: "two" }],
      ["work:2", { slug: "work", text: "three" }],
    ]);
    expect(await store.getAllBy("slug", "work")).toEqual([
      { slug: "work", text: "one" },
      { slug: "work", text: "three" },
    ]);
    // An index the store was never given is "nothing filed under it", not a
    // throw — a store opened before the index existed still answers.
    expect(await store.getAllBy("folder", "inbox")).toEqual([]);
  });

  it("is a no-op batch when handed nothing to write", async () => {
    const store = createIdbStore<string>({
      dbName: "test:empty",
      storeName: "records",
    });
    await store.setMany([]);
    await store.deleteMany([]);
    expect(await store.keys()).toEqual([]);
  });
});

describe("createIdbStore with no usable IndexedDB", () => {
  beforeEach(() => removeIndexedDb());

  it("degrades to 'nothing there' instead of throwing", async () => {
    const store = createIdbStore<string>({
      dbName: "test:absent",
      storeName: "records",
    });
    await store.set("a", "1");
    expect(await store.get("a")).toBeNull();
    expect(await store.getAll()).toEqual([]);
    expect(await store.keys()).toEqual([]);
    expect(await store.getAllBy("slug", "work")).toEqual([]);
    await store.setMany([["a", "1"]]);
    await store.delete("a");
    await store.deleteMany(["a"]);
    await store.clear();
  });
});
