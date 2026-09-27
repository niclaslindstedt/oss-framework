// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Row-level sync (SPEC §7): a local copy of one collection that you read and
// write synchronously, pushed and pulled in the background. Every row
// remembers its *base* — the value it had when last in step with the server
// — so a conflict is merged three ways, per field, instead of one side
// overwriting the other. Deletions travel as tombstones and stay deleted.

import { threeWayMerge, newerByField, type MergeOptions } from "./merge.ts";
import { CursorExpiredError } from "./errors.ts";
import type { Change, Namespace } from "./namespace.ts";
import { RecordsApi } from "./records-api.ts";

export type LocalRow<T> = {
  value: T | null;
  base: T | null;
  rev: string | null;
  dirty: boolean;
  epoch?: number;
};

export type RecordCacheState<T> = {
  cursor: number;
  rows: [string, LocalRow<T>][];
};

/** Where a store keeps its local copy between app launches. */
export type RecordCache<T> = {
  load(): Promise<RecordCacheState<T> | null>;
  save(state: RecordCacheState<T>): Promise<void>;
};

export type RowMerge<T> = (
  base: T | null,
  local: T | null,
  remote: T | null,
) => T | null;

export type RecordStoreOptions<T> = {
  /** Merge a row both sides changed. Default: three-way field merge; conflicting fields go to the newer `updatedAt`. */
  merge?: RowMerge<T>;
  /** Options for the default merge. */
  mergeOptions?: MergeOptions;
  cache?: RecordCache<T>;
};

export type SyncResult = { pulled: number; pushed: number; merged: number };

export function createMemoryRecordCache<T>(): RecordCache<T> {
  let state: RecordCacheState<T> | null = null;
  return {
    load: async () => (state ? structuredClone(state) : null),
    save: async (s) => {
      state = structuredClone(s);
    },
  };
}

/** The default row merge: per field, three ways; true conflicts to the newer `updatedAt`; edits beat deletes. */
export function defaultRowMerge<T>(options: MergeOptions = {}): RowMerge<T> {
  return (base, local, remote) => {
    if (local === null && remote === null) return null;
    if (local === null)
      return options.deleteWins && base !== null ? null : remote;
    if (remote === null)
      return options.deleteWins && base !== null ? null : local;
    return threeWayMerge(base ?? undefined, local, remote, {
      resolve: newerByField("updatedAt"),
      ...options,
    }) as T;
  };
}

const MAX_ROUNDS = 5;

export class RecordStore<T = unknown> {
  readonly api: RecordsApi<T>;
  private rows = new Map<string, LocalRow<T>>();
  private cursor = 0;
  private readonly merge: RowMerge<T>;
  private readonly cache: RecordCache<T>;
  private readonly listeners = new Set<(keys: string[]) => void>();
  private loaded: Promise<void> | null = null;
  private syncing: Promise<SyncResult> | null = null;
  private again = false;
  private mergesSinceSync = 0;

  constructor(
    readonly ns: Namespace,
    readonly collection: string,
    options: RecordStoreOptions<T> = {},
  ) {
    this.api = new RecordsApi<T>(ns, collection);
    this.merge = options.merge ?? defaultRowMerge<T>(options.mergeOptions);
    this.cache = options.cache ?? createMemoryRecordCache<T>();
  }

  /** Load the local copy from the cache (idempotent). */
  ready(): Promise<void> {
    this.loaded ??= (async () => {
      const s = await this.cache.load();
      if (s) {
        this.cursor = s.cursor;
        this.rows = new Map(s.rows);
      }
    })();
    return this.loaded;
  }

  private persist(): Promise<void> {
    return this.cache.save({ cursor: this.cursor, rows: [...this.rows] });
  }

  private emit(keys: string[]): void {
    if (keys.length === 0) return;
    for (const l of [...this.listeners]) l(keys);
  }

  /** Be told which keys changed locally or by a sync. */
  subscribe(listener: (keys: string[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(key: string): T | undefined {
    const r = this.rows.get(key);
    return r && r.value !== null ? r.value : undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  entries(): [string, T][] {
    return [...this.rows]
      .filter(([, r]) => r.value !== null)
      .map(([k, r]) => [k, r.value as T]);
  }

  /** Rows changed locally and not yet on the server. */
  pending(): string[] {
    return [...this.rows].filter(([, r]) => r.dirty).map(([k]) => k);
  }

  set(key: string, value: T): void {
    const r = this.rows.get(key) ?? {
      value: null,
      base: null,
      rev: null,
      dirty: false,
    };
    this.rows.set(key, { ...r, value, dirty: true });
    void this.persist();
    this.emit([key]);
  }

  delete(key: string): void {
    const r = this.rows.get(key);
    if (!r || r.value === null) return;
    this.rows.set(key, { ...r, value: null, dirty: true });
    void this.persist();
    this.emit([key]);
  }

  /** Apply what the server says a row now is (merging with local edits). */
  applyRemote(
    key: string,
    remote: T | null,
    rev: string,
    epoch?: number,
  ): boolean {
    const r = this.rows.get(key);
    if (r && r.rev === rev && !r.dirty) return false;
    if (!r || !r.dirty) {
      this.rows.set(key, {
        value: remote,
        base: remote,
        rev,
        dirty: false,
        epoch,
      });
      return true;
    }
    const merged = this.merge(r.base, r.value, remote);
    this.rows.set(key, {
      value: merged,
      base: remote,
      rev,
      dirty: true,
      epoch,
    });
    this.mergesSinceSync++;
    return true;
  }

  /** The store's row merge, for callers staging edits against remote state. */
  resolve(base: T | null, local: T | null, remote: T | null): T | null {
    return this.merge(base, local, remote);
  }

  /** Feed decrypted changes from a shared pull (see the row-document adapter). */
  applyChanges(changes: Change[], seq: number): string[] {
    const touched: string[] = [];
    for (const c of changes) {
      if (c.kind !== "record" || c.collection !== this.collection) continue;
      if (this.applyRemote(c.key, c.deleted ? null : (c.value as T), c.rev))
        touched.push(c.key);
    }
    this.cursor = Math.max(this.cursor, seq);
    return touched;
  }

  get since(): number {
    return this.cursor;
  }

  /** Replace local state from a full listing (first sync, or a 410 resync). */
  private async resync(): Promise<string[]> {
    const rows = await this.api.list({ includeDeleted: true });
    const seen = new Set<string>();
    const touched: string[] = [];
    for (const row of rows) {
      seen.add(row.key);
      const remote = "deleted" in row ? null : row.value;
      if (
        this.applyRemote(
          row.key,
          remote,
          row.rev,
          "epoch" in row ? row.epoch : undefined,
        )
      )
        touched.push(row.key);
    }
    for (const [key, r] of this.rows) {
      if (!seen.has(key) && !r.dirty && r.value !== null) {
        this.rows.set(key, {
          value: null,
          base: null,
          rev: null,
          dirty: false,
        });
        touched.push(key);
      }
    }
    this.cursor = this.ns.info.seq;
    return touched;
  }

  /** Pull remote changes since the last sync. */
  async pull(): Promise<string[]> {
    await this.ready();
    if (this.cursor === 0) return this.resync();
    const touched: string[] = [];
    try {
      for (;;) {
        const page = await this.ns.changes(this.cursor, { limit: 1000 });
        touched.push(...this.applyChanges(page.changes, page.seq));
        if (!page.more) break;
      }
    } catch (err) {
      if (!(err instanceof CursorExpiredError)) throw err;
      touched.push(...(await this.resync()));
    }
    return touched;
  }

  /** Push local edits; lost races are merged per row and retried. */
  async push(): Promise<{ pushed: number; merged: number }> {
    await this.ready();
    let pushed = 0;
    let merged = 0;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // A row created and deleted before it ever reached the server is simply done.
      for (const [key, r] of this.rows) {
        if (r.dirty && r.value === null && r.rev === null) {
          this.rows.set(key, {
            value: null,
            base: null,
            rev: null,
            dirty: false,
          });
        }
      }
      const dirty = [...this.rows].filter(([, r]) => r.dirty);
      if (dirty.length === 0) break;
      const results = await this.ns.batch(
        dirty.map(([key, r]) =>
          r.value === null
            ? {
                op: "delete" as const,
                collection: this.collection,
                key,
                ifRev: r.rev!,
              }
            : r.rev
              ? {
                  op: "put" as const,
                  collection: this.collection,
                  key,
                  value: r.value,
                  ifRev: r.rev,
                }
              : {
                  op: "put" as const,
                  collection: this.collection,
                  key,
                  value: r.value,
                  ifAbsent: true,
                },
        ),
        { atomic: false },
      );
      for (const [i, [key, r]] of dirty.entries()) {
        const res = results.results[i]!;
        if (res.ok) {
          this.rows.set(key, {
            value: r.value,
            base: r.value,
            rev: r.value === null ? null : res.rev,
            dirty: false,
          });
          pushed++;
          continue;
        }
        if (res.error === "not_found") {
          // deleting something the server no longer has: done
          this.rows.set(key, {
            value: null,
            base: null,
            rev: null,
            dirty: false,
          });
          continue;
        }
        if (res.error !== "conflict")
          throw new Error(`push ${key}: ${res.message}`);
        const current = await this.api.decodeCurrent(res.current);
        const remote =
          current && !("deleted" in current && current.deleted)
            ? (current as { value: T }).value
            : null;
        const next = this.merge(r.base, r.value, remote);
        this.rows.set(key, {
          value: next,
          base: remote,
          rev: current?.rev ?? null,
          dirty: true,
        });
        merged++;
      }
    }
    await this.persist();
    return { pushed, merged };
  }

  /** Pull, then push. Concurrent calls coalesce into one run (plus one follow-up). */
  sync(): Promise<SyncResult> {
    if (this.syncing) {
      this.again = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      let total: SyncResult = { pulled: 0, pushed: 0, merged: 0 };
      do {
        this.again = false;
        this.mergesSinceSync = 0;
        const touched = await this.pull();
        const { pushed, merged } = await this.push();
        await this.persist();
        this.emit(touched);
        total = {
          pulled: total.pulled + touched.length,
          pushed: total.pushed + pushed,
          merged: total.merged + merged + this.mergesSinceSync,
        };
      } while (this.again);
      return total;
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  /** Keep syncing: on server events, and shortly after local edits. */
  live(
    options: { debounceMs?: number; onError?: (err: unknown) => void } = {},
  ): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      this.sync().catch((err) => options.onError?.(err));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, options.debounceMs ?? 500);
    };
    const stopWatch = this.ns.watch(() => run());
    const stopLocal = this.subscribe(() => {
      if (this.pending().length > 0) schedule();
    });
    run();
    return () => {
      if (timer) clearTimeout(timer);
      stopWatch();
      stopLocal();
    };
  }
}
