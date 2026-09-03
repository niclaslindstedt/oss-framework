// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Keyed record stores over IndexedDB, for the data a *device* keeps rather
// than the document a backend holds.
//
// Two things pull an app here rather than to localStorage. Size: localStorage
// is a few megabytes and it is spent synchronously on the UI thread, so an
// unbounded record set (cached media bytes, an unsaved working document) runs
// the quota out and janks the app on the way. And kind: localStorage stores
// settings and pointers; anything document-shaped belongs somewhere that can
// hold hundreds of megabytes, offline, without blocking.
//
// Three choices are the app's, and each of them is a decision the module
// cannot make for you:
//
//   - **How many stores share one database.** IndexedDB versions a *database*,
//     not a store, so every store in one database has to be created by the
//     same upgrade — a second store added behind the first's back is simply
//     missing when a transaction asks for it. {@link createIdbDatabase} takes
//     the whole schema at once for exactly that reason.
//   - **Where the key lives.** A store with no `keyPath` takes its key
//     out-of-line, beside the value, so a record can be any
//     structured-cloneable thing — a string of markdown, a byte array. A store
//     *with* a `keyPath` reads the key out of the record itself, which is what
//     you want when the record already carries its own identity (a file's
//     path, a cache entry's composite key). The choice is permanent: an object
//     store cannot change its key scheme after it is created, and calling the
//     wrong write method throws.
//   - **What a failure means.** Best-effort by default: a private window, a
//     denied quota, IndexedDB switched off, a node test environment — all
//     resolve to "nothing there" rather than throwing, so a caller never has
//     to guard a cache it treats as an optimisation. Pass `strict` for a store
//     that is where something *lives*: then a write that does not land
//     rejects, and the caller can surface it as the failed save it is.
//
// Declare `indexes` when a subset has to be read or dropped on its own (all of
// one workspace's records, say); their key paths address fields *inside* an
// object record.

/** How one object store is shaped. Its key scheme is fixed at creation. */
export type IdbStoreSchema = {
  /**
   * The field the key is read from, for a store whose records carry their own
   * identity. Omit for out-of-line keys, passed beside the value.
   */
  keyPath?: string;
  /**
   * Secondary indexes, as `name → keyPath` into an object record. Read through
   * them with {@link IdbReadStore.getAllBy}.
   */
  indexes?: Readonly<Record<string, string>>;
};

/** The database's whole schema — every store, created by one upgrade. */
export type IdbDatabaseOptions<
  S extends Readonly<Record<string, IdbStoreSchema>>,
> = {
  /**
   * The database name. Namespace it the way the framework does its own
   * (`"oss:folder-handles"`) so two apps on one origin never collide.
   */
  name: string;
  /**
   * Schema version. Bump it when you add a store or an index; the upgrade
   * creates whatever is missing and leaves existing records in place.
   */
  version?: number;
  /** Every store this database holds, keyed by name. */
  stores: S;
};

/** What a store handle can be asked to read or forget, whatever its keys. */
export type IdbReadStore<T> = {
  /** The record at `key`, or null when there is none. */
  get(key: string): Promise<T | null>;
  /** Every record, in key order. */
  getAll(): Promise<T[]>;
  /** Every record whose `indexName` field equals `value`. */
  getAllBy(indexName: string, value: IDBValidKey): Promise<T[]>;
  /** Every key, in order. */
  keys(): Promise<string[]>;
  /** Forget one record. */
  delete(key: string): Promise<void>;
  /** Forget many in one transaction. */
  deleteMany(keys: readonly string[]): Promise<void>;
  /** Empty the store. */
  clear(): Promise<void>;
};

/** A store whose keys are passed beside the value. */
export type IdbKeyedStore<T> = IdbReadStore<T> & {
  /** Write one record under `key`, replacing whatever was there. */
  set(key: string, value: T): Promise<void>;
  /** Write many in one transaction — all of them land, or none do. */
  setMany(
    entries: readonly (readonly [key: string, value: T])[],
  ): Promise<void>;
};

/** A store whose keys are read out of the records themselves. */
export type IdbInlineStore<T> = IdbReadStore<T> & {
  /** Write one record, keyed by its own `keyPath` field. */
  put(value: T): Promise<void>;
  /** Write many in one transaction — all of them land, or none do. */
  putMany(values: readonly T[]): Promise<void>;
};

/** How one store handle behaves. */
export type IdbStoreHandleOptions = {
  /**
   * Reject on failure instead of resolving to "nothing there". For a store
   * that is where something lives rather than a cache of it: a write that does
   * not land has to surface as a failed save, not a silent loss.
   */
  strict?: boolean;
};

/**
 * The handle {@link createIdbDatabase} returns. The two methods are the two
 * key schemes: ask for the one the store was declared with, and you get the
 * write methods that scheme actually supports. Asking for the wrong one throws
 * with the store named, rather than failing later inside a transaction.
 */
export type IdbDatabase<S extends Readonly<Record<string, IdbStoreSchema>>> = {
  /** A handle on a store whose keys are passed beside the value. */
  keyedStore<T>(
    name: keyof S & string,
    options?: IdbStoreHandleOptions,
  ): IdbKeyedStore<T>;
  /** A handle on a store whose keys are read out of the records themselves. */
  inlineStore<T>(
    name: keyof S & string,
    options?: IdbStoreHandleOptions,
  ): IdbInlineStore<T>;
};

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Open (lazily, on first use) a database with the given schema, and hand out
 * typed store handles over it.
 *
 * Every store is created by one upgrade, so stores that share a database can
 * be reached from separate handles without one of them opening the database
 * behind the other's back and leaving its store uncreated.
 */
export function createIdbDatabase<
  const S extends Readonly<Record<string, IdbStoreSchema>>,
>(options: IdbDatabaseOptions<S>): IdbDatabase<S> {
  const { name, version = 1, stores } = options;

  // Opened once and shared across every handle. The promise resolves to null
  // in any environment with no usable IndexedDB, which turns every best-effort
  // operation into a silent no-op and every strict one into a rejection.
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
        request = indexedDB.open(name, version);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [storeName, schema] of Object.entries(stores)) {
          const store = db.objectStoreNames.contains(storeName)
            ? request.transaction?.objectStore(storeName)
            : db.createObjectStore(
                storeName,
                schema.keyPath ? { keyPath: schema.keyPath } : undefined,
              );
          for (const [index, keyPath] of Object.entries(schema.indexes ?? {})) {
            if (store && !store.indexNames.contains(index)) {
              store.createIndex(index, keyPath, { unique: false });
            }
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      // Another tab holding an older version open: leave that tab's copy alone
      // rather than fighting it for the upgrade.
      request.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  function makeStore<T>(
    storeName: string,
    handleOptions: IdbStoreHandleOptions,
  ): IdbKeyedStore<T> & IdbInlineStore<T> {
    const strict = handleOptions.strict ?? false;
    const schema =
      stores[storeName] ?? fail(`unknown object store "${storeName}"`);
    const inline = schema.keyPath !== undefined;

    // Run one request. Best-effort resolves `null` on any failure; strict
    // rejects with whatever IndexedDB said went wrong.
    function run<R>(
      mode: IDBTransactionMode,
      request: (store: IDBObjectStore) => IDBRequest<R>,
    ): Promise<R | null> {
      return openDb().then(
        (db) =>
          new Promise<R | null>((resolve, reject) => {
            const give = (err: Error) => (strict ? reject(err) : resolve(null));
            if (!db) {
              give(new Error("This browser has no usable IndexedDB"));
              return;
            }
            try {
              const tx = db.transaction(storeName, mode);
              const req = request(tx.objectStore(storeName));
              req.onsuccess = () => resolve(req.result ?? null);
              req.onerror = () =>
                give(req.error ?? new Error(`${storeName}: request failed`));
              tx.onabort = () =>
                give(
                  tx.error ?? new Error(`${storeName}: transaction aborted`),
                );
            } catch (err) {
              give(err instanceof Error ? err : new Error(String(err)));
            }
          }),
      );
    }

    // Run a batch of writes as one transaction: they all land, or none do.
    function runAll(write: (store: IDBObjectStore) => void): Promise<void> {
      return openDb().then(
        (db) =>
          new Promise<void>((resolve, reject) => {
            const give = (err: Error) => (strict ? reject(err) : resolve());
            if (!db) {
              give(new Error("This browser has no usable IndexedDB"));
              return;
            }
            try {
              const tx = db.transaction(storeName, "readwrite");
              write(tx.objectStore(storeName));
              tx.oncomplete = () => resolve();
              tx.onerror = () =>
                give(tx.error ?? new Error(`${storeName}: write failed`));
              tx.onabort = () =>
                give(
                  tx.error ?? new Error(`${storeName}: transaction aborted`),
                );
            } catch (err) {
              give(err instanceof Error ? err : new Error(String(err)));
            }
          }),
      );
    }

    const wrongMethod = (called: string, wanted: string) =>
      fail(
        `"${storeName}" ${inline ? "reads its key from the record" : "takes its key beside the value"}` +
          ` — call ${wanted}(), not ${called}().`,
      );

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
        if (!(indexName in (schema.indexes ?? {}))) return [];
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
        if (inline) wrongMethod("set", "put");
        await run("readwrite", (store) => store.put(value, key));
      },
      async setMany(entries) {
        if (inline) wrongMethod("setMany", "putMany");
        if (entries.length === 0) return;
        await runAll((store) => {
          for (const [key, value] of entries) store.put(value, key);
        });
      },
      async put(value) {
        if (!inline) wrongMethod("put", "set");
        await run("readwrite", (store) => store.put(value));
      },
      async putMany(values) {
        if (!inline) wrongMethod("putMany", "setMany");
        if (values.length === 0) return;
        await runAll((store) => {
          for (const value of values) store.put(value);
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

  function handle(storeName: string, inlineWanted: boolean): void {
    const schema = stores[storeName];
    if (!schema) fail(`unknown object store "${storeName}"`);
    const inline = schema.keyPath !== undefined;
    if (inline !== inlineWanted) {
      fail(
        `"${storeName}" ${inline ? "reads its key from the record" : "takes its key beside the value"}` +
          ` — ask for ${inline ? "inlineStore" : "keyedStore"}().`,
      );
    }
  }

  return {
    keyedStore<T>(
      storeName: keyof S & string,
      handleOptions: IdbStoreHandleOptions = {},
    ) {
      handle(storeName, false);
      return makeStore<T>(storeName, handleOptions);
    },
    inlineStore<T>(
      storeName: keyof S & string,
      handleOptions: IdbStoreHandleOptions = {},
    ) {
      handle(storeName, true);
      return makeStore<T>(storeName, handleOptions);
    },
  };
}

/** How a single-store database is named and shaped. */
export type IdbStoreOptions = {
  /** The database name. */
  dbName: string;
  /** The object store inside it. */
  storeName: string;
  /** Schema version. */
  version?: number;
  /** Secondary indexes, as `name → keyPath` into an object record. */
  indexes?: Readonly<Record<string, string>>;
  /**
   * Reject on failure instead of resolving to "nothing there" — for a store
   * that is where something lives rather than a cache of it.
   */
  strict?: boolean;
};

/** The handle {@link createIdbStore} returns. */
export type IdbStore<T> = IdbKeyedStore<T>;

function singleStore(
  options: IdbStoreOptions,
  keyPath?: string,
): IdbDatabase<Record<string, IdbStoreSchema>> {
  return createIdbDatabase({
    name: options.dbName,
    version: options.version,
    stores: { [options.storeName]: { keyPath, indexes: options.indexes } },
  });
}

/**
 * One out-of-line-keyed store in a database of its own — the common case, and
 * sugar over {@link createIdbDatabase}. Reach for that one instead as soon as
 * a second store shares the database: IndexedDB versions the database, so
 * every store in it has to be declared by the same upgrade.
 */
export function createIdbStore<T>(options: IdbStoreOptions): IdbKeyedStore<T> {
  return singleStore(options).keyedStore<T>(options.storeName, {
    strict: options.strict,
  });
}

/**
 * The same, for a store whose records carry their own key — a file's path, a
 * cache entry's composite id. `keyPath` names the field it is read from.
 */
export function createInlineIdbStore<T>(
  options: IdbStoreOptions & { keyPath: string },
): IdbInlineStore<T> {
  return singleStore(options, options.keyPath).inlineStore<T>(
    options.storeName,
    { strict: options.strict },
  );
}
