// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Default storage backend: a single document in `localStorage`. Speaks bytes
// through the `StorageAdapter` contract — it only moves text in and out of a
// `Storage` under one key. The `Storage` object is injectable so tests run
// against an in-memory stub instead of the real `localStorage`.
//
// This is the only backend that implements `loadSync`: `localStorage` returns
// synchronously, so an app can paint from stored bytes on the very first frame
// rather than flashing an empty state while an async `load()` resolves.

import type { StorageAdapter, StoredSnapshot } from "../adapter.ts";
import { type Logger, noopLogger } from "../logger.ts";

export type BrowserLocalStorageOptions = {
  /** Where to read/write. Defaults to `globalThis.localStorage`. */
  storage?: Storage;
  /** The single key the document lives under. Defaults to `oss:document`. */
  key?: string;
  /** Optional sink for diagnostics. Defaults to a no-op. */
  logger?: Logger;
};

const DEFAULT_KEY = "oss:document";

export class BrowserLocalStorageAdapter implements StorageAdapter {
  readonly id = "browser" as const;
  readonly label = "This device";
  readonly capabilities: ReadonlySet<"loadSync"> = new Set(["loadSync"]);

  private readonly storage: Storage;
  private readonly key: string;
  private readonly log: Logger;

  constructor(options: BrowserLocalStorageOptions = {}) {
    this.storage = options.storage ?? globalThis.localStorage;
    this.key = options.key ?? DEFAULT_KEY;
    this.log = options.logger ?? noopLogger;
  }

  loadSync(): StoredSnapshot | null {
    const text = this.read();
    if (text === null) {
      this.log.info(`loadSync: no document at [${this.key}]`);
      return null;
    }
    this.log.info(`loadSync: read ${text.length} B from [${this.key}]`);
    return { text };
  }

  async load(): Promise<StoredSnapshot | null> {
    return this.loadSync();
  }

  async save(text: string): Promise<StoredSnapshot> {
    try {
      this.storage.setItem(this.key, text);
      this.log.info(`save: wrote ${text.length} B to [${this.key}]`);
    } catch (err) {
      // Quota exceeded, or disabled / blocked storage. Surface it so a
      // silently-failing save is debuggable, then rethrow — a caller treats a
      // thrown save as a failed write.
      this.log.error(`save: write to [${this.key}] failed`, err);
      throw err;
    }
    return { text };
  }

  private read(): string | null {
    try {
      return this.storage.getItem(this.key);
    } catch (err) {
      // disabled / blocked storage — treat as "no data"
      this.log.warn(`read: [${this.key}] unavailable — treating as empty`, err);
      return null;
    }
  }
}

/**
 * Delete the document at `key`. Best-effort: a blocked / disabled `Storage` is
 * treated as "nothing to remove".
 */
export function deleteLocalDocument(
  key: string = DEFAULT_KEY,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // best-effort
  }
}
