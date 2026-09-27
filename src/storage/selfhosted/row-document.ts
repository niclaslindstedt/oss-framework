// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A `StorageAdapter` for apps that keep ONE JSON document (meds, period,
// baby, time, calendar) but deserve row-level merging. The app still calls
// `save(text)` / `load()`; underneath, each entry of the configured maps
// (`medications[id]`, `days[date]`) is its own row, everything else is one
// "root" row, and only rows that changed are sent. Two devices editing
// different days never conflict; the same day merges per field.
//
// When a save had to merge in someone else's changes, it throws
// `ConflictError` carrying the merged document — the contract apps already
// handle (adopt / merge, then save again, which then succeeds).

import {
  ConflictError,
  type StorageAdapter,
  type StoredSnapshot,
} from "../adapter.ts";
import { AuthError } from "../adapter.ts";
import { jsonEqual, type MergeOptions } from "./merge.ts";
import type { Namespace } from "./namespace.ts";
import { RecordStore, type RowMerge } from "./record-store.ts";
import { CursorExpiredError } from "./errors.ts";

export type RowDocumentOptions = {
  /** Top-level keys whose values are maps (`{ [id]: row }`) stored one row per entry. */
  rows: string[];
  /** Collection for the rest of the document. Default `__doc`. */
  rootCollection?: string;
  merge?: RowMerge<unknown>;
  mergeOptions?: MergeOptions;
  saveDebounceMs?: number;
  label?: string;
};

type Doc = Record<string, unknown>;

const ROOT_KEY = "root";

export function createRowDocumentAdapter(
  ns: Namespace,
  options: RowDocumentOptions,
): StorageAdapter {
  const rootCollection = options.rootCollection ?? "__doc";
  const storeOpts = {
    merge: options.merge,
    mergeOptions: options.mergeOptions,
  };
  const maps = new Map(
    options.rows.map((name) => [
      name,
      new RecordStore<unknown>(ns, name, storeOpts),
    ]),
  );
  const root = new RecordStore<unknown>(ns, rootCollection, storeOpts);
  const stores = [root, ...maps.values()];
  let initialized = false;

  async function pullAll(): Promise<void> {
    if (!initialized || stores.some((s) => s.since === 0)) {
      for (const s of stores) await s.pull();
      initialized = true;
      return;
    }
    const since = Math.min(...stores.map((s) => s.since));
    try {
      for (let cursor = since; ;) {
        const page = await ns.changes(cursor, { limit: 1000 });
        for (const s of stores) s.applyChanges(page.changes, page.seq);
        cursor = page.seq;
        if (!page.more) break;
      }
    } catch (err) {
      if (!(err instanceof CursorExpiredError)) throw err;
      for (const s of stores) await s.pull();
    }
  }

  function assemble(): Doc | null {
    const base = root.get(ROOT_KEY) as Doc | undefined;
    const anyRows = [...maps.values()].some((s) => s.entries().length > 0);
    if (base === undefined && !anyRows) return null;
    const doc: Doc = { ...(base ?? {}) };
    for (const [name, store] of maps)
      doc[name] = Object.fromEntries(store.entries());
    return doc;
  }

  // The document the app last saw (from load or a save). Edits are what
  // changed relative to it; everything else in the store — including rows
  // another device changed meanwhile — is left alone, and rows both sides
  // changed are merged three ways.
  let lastDoc: Doc | null = null;

  function splitRoot(doc: Doc): Doc {
    const rest: Doc = {};
    for (const [k, v] of Object.entries(doc)) if (!maps.has(k)) rest[k] = v;
    return rest;
  }

  function stageRow(
    store: RecordStore<unknown>,
    key: string,
    prev: unknown,
    next: unknown,
  ): void {
    if (jsonEqual(prev, next)) return; // not edited by the app
    const current = store.get(key);
    const value =
      jsonEqual(current, prev) || (current === undefined && prev === undefined)
        ? (next ?? null)
        : store.resolve(prev ?? null, next ?? null, current ?? null);
    if (value === null) store.delete(key);
    else if (!jsonEqual(current, value)) store.set(key, value);
  }

  function stage(doc: Doc): void {
    stageRow(
      root,
      ROOT_KEY,
      lastDoc ? splitRoot(lastDoc) : undefined,
      splitRoot(doc),
    );
    for (const [name, store] of maps) {
      const next = (doc[name] ?? {}) as Record<string, unknown>;
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        throw new Error(
          `document.${name} must be an object map to be stored as rows`,
        );
      }
      const prev = (lastDoc?.[name] ?? {}) as Record<string, unknown>;
      for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        stageRow(store, key, prev[key], next[key]);
      }
    }
  }

  const revision = () => String(ns.info.seq);

  async function load(): Promise<StoredSnapshot | null> {
    await pullAll();
    const doc = assemble();
    lastDoc = doc;
    return doc === null
      ? null
      : { text: JSON.stringify(doc), revision: revision() };
  }

  async function save(text: string): Promise<StoredSnapshot> {
    let doc: Doc;
    try {
      doc = JSON.parse(text) as Doc;
    } catch {
      throw new Error("the row-document adapter stores JSON documents");
    }
    await pullAll();
    stage(doc);
    for (const s of stores) await s.push();
    // Anything that landed meanwhile is merged in by the next pull.
    await pullAll();
    const merged = assemble() ?? {};
    lastDoc = merged;
    if (!jsonEqual(merged, doc)) {
      throw new ConflictError({
        text: JSON.stringify(merged),
        revision: revision(),
      });
    }
    return { text, revision: revision() };
  }

  return {
    id: "selfhosted",
    label: options.label ?? "Self-hosted",
    capabilities: new Set(["getRevision", "probe", "watch"]),
    saveDebounceMs: options.saveDebounceMs ?? 800,
    load,
    save,
    async getRevision() {
      await ns.refresh();
      return revision();
    },
    async probe() {
      try {
        await ns.transport.request("GET", `/v1/namespaces/${ns.id}`);
        return true;
      } catch (err) {
        if (err instanceof AuthError) throw err;
        return false;
      }
    },
    watch(onRemoteChange) {
      let busy = false;
      return ns.watch(async () => {
        if (busy) return;
        busy = true;
        try {
          const before = JSON.stringify(assemble());
          const snap = await load();
          if (snap && snap.text !== before) onRemoteChange(snap);
        } catch {
          // the next event retries
        } finally {
          busy = false;
        }
      });
    },
  };
}
