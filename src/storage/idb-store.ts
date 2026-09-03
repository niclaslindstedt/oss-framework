// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A small keyed record store over IndexedDB, for the data a *device* keeps
// rather than the document a backend holds.
//
// Two things pull an app here rather than to localStorage. Size: localStorage
// is a few megabytes and it is spent synchronously on the UI thread, so an
// unbounded record set (cached media bytes, an unsaved working document) runs
// the quota out and janks the app on the way. And kind: localStorage stores
// settings and pointers; anything document-shaped belongs somewhere that can
// hold hundreds of megabytes, offline, without blocking.
//
// Every call is **best-effort**. A private window, a denied quota, IndexedDB
// switched off, a node test environment — all resolve to "nothing there"
// rather than throwing, so a caller never has to guard the cache it treats as
// an optimisation. Nothing here is a place to keep the only copy of anything.
//
// Keys are out-of-line (`put(value, key)`), so a record can be any
// structured-cloneable value — a string of markdown, a byte array, an object.
// Declare `indexes` when a subset has to be read or dropped on its own (all of
// one workspace's records, say); their key paths address fields *inside* an
// object record.

/** How a store is named and shaped. Passed once, to {@link createIdbStore}. */
export type IdbStoreOptions = {
  /**
   * The database name. Namespace it the way the framework does its own
   * (`"oss:folder-handles"`) so two apps on one origin never collide.
   */
  dbName: string;
  /** The object store inside it. */
  storeName: string;
  /**
   * Schema version. Bump it when you add an index; the upgrade creates
   * whatever is missing and leaves existing records in place.
   */
  version?: number;
  /**
   * Secondary indexes to create, as `name → keyPath` into an object record.
   * Read through them with {@link IdbStore.getAllBy}.
   */
  indexes?: Readonly<Record<string, string>>;
};

/** The handle {@link createIdbStore} returns. */
export type IdbStore<T> = {
  /** The record at `key`, or null when there is none (or no usable store). */
  get(key: string): Promise<T | null>;
  /** Every record, in key order. Empty when there is no usable store. */
  getAll(): Promise<T[]>;
  /** Every record whose `indexName` field equals `value`. */
  getAllBy(indexName: string, value: IDBValidKey): Promise<T[]>;
  /** Every key, in order. */
  keys(): Promise<string[]>;
  /** Write one record, replacing whatever was there. */
  set(key: string, value: T): Promise<void>;
  /** Write many in one transaction — all of them land, or none do. */
  setMany(
    entries: readonly (readonly [key: string, value: T])[],
  ): Promise<void>;
  /** Forget one record. */
  delete(key: string): Promise<void>;
  /** Forget many in one transaction. */
  deleteMany(keys: readonly string[]): Promise<void>;
  /** Empty the store. */
  clear(): Promise<void>;
};

export function createIdbStore<T>(options: IdbStoreOptions): IdbStore<T> {
  const { dbName, storeName, version = 1, indexes = {} } = options;

  // Opened once and shared. The promise resolves to null in any environment
  // with no usable IndexedDB, which turns every operation below into a silent
  // no-op.
  let dbPromise: Promise<IDBDatabase | null> | null = null;

  function openDb(): Promise<IDBDatabase | null> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(dbName, version);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(storeName)
          ? request.transaction?.objectStore(storeName)
          : db.createObjectStore(storeName);
        for (const [name, keyPath] of Object.entries(indexes)) {
          if (store && !store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, { unique: false });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      // Another tab holding an older version open: leave that tab's copy
      // alone rather than fighting it for the upgrade.
      request.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  // Run one request against the store, resolving to null on any failure.
  function run<R>(
    mode: IDBTransactionMode,
    request: (store: IDBObjectStore) => IDBRequest<R>,
  ): Promise<R | null> {
    return openDb().then(
      (db) =>
        new Promise<R | null>((resolve) => {
          if (!db) {
            resolve(null);
            return;
          }
          try {
            const tx = db.transaction(storeName, mode);
            const req = request(tx.objectStore(storeName));
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
          } catch {
            resolve(null);
          }
        }),
    );
  }

  // Run a batch of writes as one transaction: they all land, or none do.
  function runAll(write: (store: IDBObjectStore) => void): Promise<void> {
    return openDb().then(
      (db) =>
        new Promise<void>((resolve) => {
          if (!db) {
            resolve();
            return;
          }
          try {
            const tx = db.transaction(storeName, "readwrite");
            write(tx.objectStore(storeName));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
          } catch {
            resolve();
          }
        }),
    );
  }

  return {
    async get(key) {
      return await run<T>("readonly", (store) => store.get(key));
    },
    async getAll() {
      return (await run<T[]>("readonly", (store) => store.getAll())) ?? [];
    },
    async getAllBy(indexName, value) {
      // An index this store was never declared with has nothing filed under
      // it. Answer "none" rather than reading through it — and if the live
      // database predates the declaration, `run`'s own guard catches the
      // throw and says the same.
      if (!(indexName in indexes)) return [];
      return (
        (await run<T[]>("readonly", (store) =>
          store.index(indexName).getAll(value),
        )) ?? []
      );
    },
    async keys() {
      const keys = await run<IDBValidKey[]>("readonly", (store) =>
        store.getAllKeys(),
      );
      return (keys ?? []).map(String);
    },
    async set(key, value) {
      await run("readwrite", (store) => store.put(value, key));
    },
    async setMany(entries) {
      if (entries.length === 0) return;
      await runAll((store) => {
        for (const [key, value] of entries) store.put(value, key);
      });
    },
    async delete(key) {
      await run("readwrite", (store) => store.delete(key));
    },
    async deleteMany(keys) {
      if (keys.length === 0) return;
      await runAll((store) => {
        for (const key of keys) store.delete(key);
      });
    },
    async clear() {
      await run("readwrite", (store) => store.clear());
    },
  };
}
