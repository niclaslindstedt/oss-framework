// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createIdbDatabase,
  createIdbStore,
  createInlineIdbStore,
} from "../src/storage/index.ts";
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

describe("createIdbDatabase", () => {
  beforeEach(() => installFakeIndexedDb());

  // calc's shape: a best-effort tape beside a strict device backend, both in
  // one database — which is the whole reason the schema is declared at the
  // database level rather than per store.
  const schema = {
    name: "test:two-stores",
    version: 2,
    stores: {
      tapes: {},
      files: { keyPath: "path" },
    },
  } as const;

  type DeviceFile = { path: string; text: string };

  it("creates every declared store in one upgrade", async () => {
    const db = createIdbDatabase(schema);
    const tapes = db.keyedStore<string>("tapes");
    const files = db.inlineStore<DeviceFile>("files");
    await tapes.set("work", "# a tape");
    await files.put({ path: "calculations/a.md", text: "# a file" });
    expect(await tapes.get("work")).toBe("# a tape");
    expect(await files.get("calculations/a.md")).toEqual({
      path: "calculations/a.md",
      text: "# a file",
    });
  });

  it("keys an in-line store off the record itself", async () => {
    const db = createIdbDatabase(schema);
    const files = db.inlineStore<DeviceFile>("files");
    await files.putMany([
      { path: "b.md", text: "two" },
      { path: "a.md", text: "one" },
    ]);
    expect(await files.keys()).toEqual(["a.md", "b.md"]);
    await files.delete("a.md");
    expect(await files.getAll()).toEqual([{ path: "b.md", text: "two" }]);
  });

  it("names the store when a handle is asked for the wrong key scheme", () => {
    const db = createIdbDatabase(schema);
    expect(() => db.inlineStore("tapes")).toThrow(/"tapes".*keyedStore/s);
    expect(() => db.keyedStore("files")).toThrow(/"files".*inlineStore/s);
  });

  it("refuses a store it was never told about", () => {
    const db = createIdbDatabase(schema);
    // TypeScript rejects this outright — the store names are a union from the
    // schema — so the cast is the point of the test: the runtime guard is what
    // a JavaScript caller, or a name built at runtime, actually meets.
    const name = "nope" as "tapes";
    expect(() => db.keyedStore(name)).toThrow(/unknown object store "nope"/);
  });
});

describe("a strict store", () => {
  const options = {
    dbName: "test:strict",
    storeName: "files",
    keyPath: "path",
    strict: true,
  } as const;

  it("reads and writes exactly like a best-effort one when all is well", async () => {
    installFakeIndexedDb();
    const files = createInlineIdbStore<{ path: string; text: string }>(options);
    await files.put({ path: "a.md", text: "one" });
    expect(await files.get("a.md")).toEqual({ path: "a.md", text: "one" });
    // Absent is not a failure — it still answers null rather than rejecting.
    expect(await files.get("missing.md")).toBeNull();
  });

  it("rejects rather than swallowing when there is no usable IndexedDB", async () => {
    removeIndexedDb();
    const files = createInlineIdbStore<{ path: string; text: string }>(options);
    await expect(files.get("a.md")).rejects.toThrow(/no usable IndexedDB/);
    await expect(files.put({ path: "a.md", text: "one" })).rejects.toThrow(
      /no usable IndexedDB/,
    );
    await expect(files.getAll()).rejects.toThrow(/no usable IndexedDB/);
    await expect(files.delete("a.md")).rejects.toThrow(/no usable IndexedDB/);
    await expect(files.clear()).rejects.toThrow(/no usable IndexedDB/);
    await expect(
      files.putMany([{ path: "a.md", text: "one" }]),
    ).rejects.toThrow(/no usable IndexedDB/);
  });

  it("rejects when a write itself fails", async () => {
    installFakeIndexedDb();
    const files = createInlineIdbStore<{ path?: string; text: string }>(
      options,
    );
    // No `path` on the record, so the store has no key to file it under —
    // the request errors, and a strict store surfaces that.
    await expect(files.put({ text: "keyless" })).rejects.toThrow();
  });

  it("leaves the best-effort default alone", async () => {
    removeIndexedDb();
    const cache = createIdbStore<string>({
      dbName: "test:lenient",
      storeName: "records",
    });
    await expect(cache.get("a")).resolves.toBeNull();
    await expect(cache.set("a", "1")).resolves.toBeUndefined();
  });
});
