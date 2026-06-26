// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// IndexedDB-backed persistence for the `FileSystemDirectoryHandle` the user
// grants when they pick a folder as the storage backend. Directory handles are
// structured-clone-safe, so IndexedDB can persist one across reloads — and the
// OS-level permission grant survives with it, gated by a fresh
// `queryPermission` on the next session.
//
// There is exactly one handle for the whole app. Every operation is
// best-effort: if IndexedDB is unavailable (Firefox private mode, locked-down
// settings), each function resolves to the empty / null result and the caller
// falls back to another backend.

const DB_NAME = "oss:folder-handles";
const DB_VERSION = 1;
const STORE = "handles";
// Single record key — there's only ever one picked folder.
const HANDLE_KEY = "active";

type HandleRecord = {
  key: string;
  handle: FileSystemDirectoryHandle;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const req = tx(db, "readwrite").put({
      key: HANDLE_KEY,
      handle,
      createdAt: Date.now(),
    } satisfies HandleRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  db.close();
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  if (!db) return null;
  const record = await new Promise<HandleRecord | null>((resolve) => {
    const req = tx(db, "readonly").get(HANDLE_KEY);
    req.onsuccess = () =>
      resolve((req.result as HandleRecord | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return record?.handle ?? null;
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const req = tx(db, "readwrite").delete(HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  db.close();
}

/**
 * True only in browsers that expose the File System Access API directory
 * picker. Currently Chromium-based (Chrome, Edge, Opera, Brave, Arc); Firefox
 * and Safari return false, so the picker should be hidden there.
 */
export function isFolderBackendAvailable(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export type FolderPermissionResult = "granted" | "denied" | "prompt-denied";

/**
 * Probe (and, when allowed, request) the readwrite permission for a handle.
 * Pass `requestIfPrompt: false` from non-gesture contexts (a boot probe) so the
 * call doesn't throw; pass true from the Connect / Reconnect click handler
 * where a user gesture is in scope.
 */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  requestIfPrompt = false,
): Promise<FolderPermissionResult> {
  const mode: FileSystemPermissionMode = "readwrite";
  const status = await handle.queryPermission({ mode });
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if (!requestIfPrompt) return "prompt-denied";
  const requested = await handle.requestPermission({ mode });
  return requested === "granted" ? "granted" : "prompt-denied";
}
