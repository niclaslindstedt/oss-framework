// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where a device keeps its keys (SPEC §4.4). Two kinds of vault:
//
// - "cryptokey" vaults hold `CryptoKey` objects as they are. IndexedDB can
//   store a CryptoKey by structured clone *without* exporting it, so a
//   non-extractable key stays non-extractable at rest: script on the page
//   can use it, but can never read its bytes out.
// - "bytes" vaults hold raw bytes — the shape a native keystore (iOS
//   Keychain, Android Keystore, a Secure Enclave–wrapped blob) speaks. A
//   native wrapper installs one as `window.__ossKeyVault`.
//
// The client stores keys as CryptoKeys when the vault can, and as bytes
// (imported non-extractable on every load) when it cannot.

export type VaultValue = CryptoKey | Uint8Array;

export interface KeyVault {
  readonly kind: "cryptokey" | "bytes";
  get(id: string): Promise<VaultValue | null>;
  put(id: string, value: VaultValue): Promise<void>;
  delete(id: string): Promise<void>;
  /** Delete every entry whose id starts with `prefix` (all when omitted). */
  clear(prefix?: string): Promise<void>;
}

export function createMemoryKeyVault(
  kind: KeyVault["kind"] = "cryptokey",
): KeyVault {
  const map = new Map<string, VaultValue>();
  return {
    kind,
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(id, value) {
      if (kind === "bytes" && !(value instanceof Uint8Array))
        throw new Error("this vault stores bytes only");
      map.set(id, value);
    },
    async delete(id) {
      map.delete(id);
    },
    async clear(prefix = "") {
      for (const k of [...map.keys()]) if (k.startsWith(prefix)) map.delete(k);
    },
  };
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

/**
 * A vault in IndexedDB holding non-extractable `CryptoKey`s (the web default).
 * Namespace the database per app: one origin can host several apps.
 */
export function createIndexedDbKeyVault(options: { name: string }): KeyVault {
  const STORE = "keys";
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      const r = indexedDB.open(`oss-keyvault:${options.name}`, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE))
          r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error("IndexedDB open failed"));
    }));
  async function run<T>(
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open();
    const tx = db.transaction(STORE, mode);
    return req(fn(tx.objectStore(STORE)));
  }
  return {
    kind: "cryptokey",
    async get(id) {
      return (
        ((await run("readonly", (s) => s.get(id))) as VaultValue | undefined) ??
        null
      );
    },
    async put(id, value) {
      await run("readwrite", (s) => s.put(value, id));
    },
    async delete(id) {
      await run("readwrite", (s) => s.delete(id));
    },
    async clear(prefix = "") {
      const keys = (await run("readonly", (s) =>
        s.getAllKeys(),
      )) as IDBValidKey[];
      for (const k of keys) {
        if (String(k).startsWith(prefix))
          await run("readwrite", (s) => s.delete(k));
      }
    },
  };
}

// ---- native host seam ---------------------------------------------------------

/**
 * What a native wrapper installs at `window.__ossKeyVault` to put keys in the
 * platform keystore. Values cross the bridge as base64url strings. Items
 * should be stored device-only and available only while unlocked (e.g.
 * `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
 */
export type KeyVaultHost = {
  readonly version: 1;
  get(id: string): Promise<string | null>;
  put(id: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
  clear(prefix: string): Promise<void>;
};

export const KEY_VAULT_HOST_PROPERTY = "__ossKeyVault";
export const KEY_VAULT_HOST_EVENT = "oss:key-vault-host";

/** The installed native key vault host, validated, or null. */
export function getKeyVaultHost(): KeyVaultHost | null {
  if (typeof window === "undefined") return null;
  const h = (window as unknown as Record<string, unknown>)[
    KEY_VAULT_HOST_PROPERTY
  ] as Partial<KeyVaultHost> | undefined;
  if (!h || typeof h !== "object" || h.version !== 1) return null;
  for (const m of ["get", "put", "delete", "clear"] as const)
    if (typeof h[m] !== "function") return null;
  return h as KeyVaultHost;
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function createHostKeyVault(host: KeyVaultHost): KeyVault {
  return {
    kind: "bytes",
    async get(id) {
      const v = await host.get(id);
      return v === null ? null : fromB64(v);
    },
    async put(id, value) {
      if (!(value instanceof Uint8Array))
        throw new Error("the native key vault stores bytes only");
      await host.put(id, toB64(value));
    },
    delete: (id) => host.delete(id),
    clear: (prefix = "") => host.clear(prefix),
  };
}

/** The best vault available: the native keystore when a host offers one, else IndexedDB. */
export function defaultKeyVault(name: string): KeyVault {
  const host = getKeyVaultHost();
  return host ? createHostKeyVault(host) : createIndexedDbKeyVault({ name });
}
