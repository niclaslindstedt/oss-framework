// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A pocket-sized IndexedDB, enough for the shapes `createIdbStore` uses:
// `open` with an upgrade, out-of-line keyed `get` / `getAll` / `getAllKeys` /
// `put` / `delete` / `clear`, one index per store, and transactions that
// complete (or abort) asynchronously. jsdom ships no IndexedDB at all, and
// pulling a polyfill in as a dev dependency would buy more than these tests
// need — the framework's own rule is to prefer none.
//
// Requests resolve on a macrotask so callbacks are assigned before they fire,
// exactly as the real API guarantees, and reads come back in key order rather
// than insertion order — also a real guarantee, and one callers lean on.

type Rec = { key: string; value: unknown };

class FakeRequest<T> {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result!: T;
  settle(result: T) {
    this.result = result;
    setTimeout(() => this.onsuccess?.(), 0);
  }
  fail() {
    setTimeout(() => this.onerror?.(), 0);
  }
}

function inKeyOrder(records: Map<string, Rec>): Rec[] {
  return [...records.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

class FakeIndex {
  constructor(
    private readonly records: Map<string, Rec>,
    private readonly keyPath: string,
  ) {}
  getAll(value: unknown) {
    const req = new FakeRequest<unknown[]>();
    const hits = inKeyOrder(this.records)
      .filter(
        (r) => (r.value as Record<string, unknown>)?.[this.keyPath] === value,
      )
      .map((r) => r.value);
    req.settle(hits);
    return req;
  }
}

class FakeStore {
  readonly indexNames: { contains: (name: string) => boolean };
  constructor(
    private readonly records: Map<string, Rec>,
    private readonly indexes: Map<string, string>,
    private readonly onWrite: () => void,
    private readonly keyPath?: string,
  ) {
    this.indexNames = { contains: (name) => this.indexes.has(name) };
  }
  createIndex(name: string, keyPath: string) {
    this.indexes.set(name, keyPath);
  }
  index(name: string) {
    const keyPath = this.indexes.get(name);
    if (keyPath === undefined) throw new Error(`no index ${name}`);
    return new FakeIndex(this.records, keyPath);
  }
  get(key: string) {
    const req = new FakeRequest<unknown>();
    req.settle(this.records.get(key)?.value);
    return req;
  }
  getAll() {
    const req = new FakeRequest<unknown[]>();
    req.settle(inKeyOrder(this.records).map((r) => r.value));
    return req;
  }
  getAllKeys() {
    const req = new FakeRequest<string[]>();
    req.settle(inKeyOrder(this.records).map((r) => r.key));
    return req;
  }
  put(value: unknown, key?: string) {
    const req = new FakeRequest<string>();
    // Mirror IndexedDB's own rule: a store with a keyPath reads the key out of
    // the record and rejects an explicit one; a store without needs one.
    if (this.keyPath !== undefined) {
      if (key !== undefined) {
        setTimeout(() => req.onerror?.(), 0);
        return req;
      }
      const inline = (value as Record<string, unknown>)?.[this.keyPath];
      if (typeof inline !== "string") {
        setTimeout(() => req.onerror?.(), 0);
        return req;
      }
      this.records.set(inline, { key: inline, value });
      this.onWrite();
      req.settle(inline);
      return req;
    }
    if (key === undefined) {
      setTimeout(() => req.onerror?.(), 0);
      return req;
    }
    this.records.set(key, { key, value });
    this.onWrite();
    req.settle(key);
    return req;
  }
  delete(key: string) {
    const req = new FakeRequest<undefined>();
    this.records.delete(key);
    this.onWrite();
    req.settle(undefined);
    return req;
  }
  clear() {
    const req = new FakeRequest<undefined>();
    this.records.clear();
    this.onWrite();
    req.settle(undefined);
    return req;
  }
}

class FakeDb {
  readonly stores = new Map<string, Map<string, Rec>>();
  readonly indexes = new Map<string, Map<string, string>>();
  readonly keyPaths = new Map<string, string | undefined>();
  readonly objectStoreNames = { contains: (n: string) => this.stores.has(n) };
  createObjectStore(name: string, options?: { keyPath?: string }) {
    this.stores.set(name, new Map());
    this.indexes.set(name, new Map());
    this.keyPaths.set(name, options?.keyPath);
    return this.objectStore(name, () => {});
  }
  objectStore(name: string, onWrite: () => void) {
    if (!this.stores.has(name)) throw new Error(`no object store ${name}`);
    return new FakeStore(
      this.stores.get(name) ?? new Map(),
      this.indexes.get(name) ?? new Map(),
      onWrite,
      this.keyPaths.get(name),
    );
  }
  transaction(name: string) {
    const tx: {
      oncomplete: (() => void) | null;
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      objectStore: (n: string) => FakeStore;
    } = {
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: (n: string) =>
        this.objectStore(n, () => setTimeout(() => tx.oncomplete?.(), 0)),
    };
    // A read-only transaction completes on its own once its requests settle.
    setTimeout(() => tx.oncomplete?.(), 0);
    void name;
    return tx;
  }
}

/** Install a fresh in-memory IndexedDB on `globalThis`, and hand back the
 *  databases it holds so a test can inspect them. */
export function installFakeIndexedDb(): Map<string, FakeDb> {
  const dbs = new Map<string, FakeDb>();
  const open = (name: string) => {
    const req = new FakeRequest<FakeDb>() as FakeRequest<FakeDb> & {
      onupgradeneeded: (() => void) | null;
      onblocked: (() => void) | null;
      transaction: null;
    };
    req.onupgradeneeded = null;
    req.onblocked = null;
    req.transaction = null;
    const fresh = !dbs.has(name);
    const db = dbs.get(name) ?? new FakeDb();
    dbs.set(name, db);
    req.result = db;
    setTimeout(() => {
      if (fresh) req.onupgradeneeded?.();
      req.onsuccess?.();
    }, 0);
    return req;
  };
  (globalThis as { indexedDB?: unknown }).indexedDB = { open };
  return dbs;
}

/** Take it away again — the "no usable IndexedDB" case. */
export function removeIndexedDb(): void {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
}
