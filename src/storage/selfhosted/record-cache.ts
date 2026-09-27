// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RecordStore's local copy in IndexedDB, optionally encrypted at rest with
// a non-extractable AES-GCM key (health data should not sit in the browser
// in the clear either). Best-effort, like the framework's other IDB caches:
// no IndexedDB means the store simply starts empty and syncs.

import { createIdbStore } from "../idb-store.ts";
import { fromUtf8, randomBytes, utf8 } from "./crypto.ts";
import type { RecordCache, RecordCacheState } from "./record-store.ts";

export function createIdbRecordCache<T>(options: { dbName: string; key: string; encryptWith?: CryptoKey }): RecordCache<T> {
  const store = createIdbStore<Uint8Array | string>({ dbName: options.dbName, storeName: "records" });
  const aadText = `record-cache|${options.key}`;
  return {
    async load() {
      const raw = await store.get(options.key);
      if (raw === null) return null;
      try {
        if (!options.encryptWith) return JSON.parse(raw as string) as RecordCacheState<T>;
        const bytes = raw as Uint8Array;
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(bytes.slice(0, 12)), additionalData: new Uint8Array(utf8(aadText)) },
          options.encryptWith,
          new Uint8Array(bytes.slice(12)),
        );
        return JSON.parse(fromUtf8(new Uint8Array(plain))) as RecordCacheState<T>;
      } catch {
        return null; // unreadable (key changed): start clean and resync
      }
    },
    async save(state) {
      const json = JSON.stringify(state);
      if (!options.encryptWith) {
        await store.set(options.key, json);
        return;
      }
      const iv = randomBytes(12);
      const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv), additionalData: new Uint8Array(utf8(aadText)) },
        options.encryptWith,
        new Uint8Array(utf8(json)),
      );
      const out = new Uint8Array(12 + ct.byteLength);
      out.set(iv, 0);
      out.set(new Uint8Array(ct), 12);
      await store.set(options.key, out);
    },
  };
}
