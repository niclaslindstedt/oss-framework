// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Local-folder backend, built on the File System Access API. It stores files
// inside a user-picked directory; the directory is acquired by the app through
// `showDirectoryPicker` and persisted in IndexedDB (see `handle-store.ts`), so
// this module only ever sees a live handle.
//
// `createFolderFileStore` returns the byte-level `FileStore` — the seam an app
// with a custom on-disk layout binds its own adapter over.
// `createFolderAdapter` is the convenience path: it wraps that store in the
// framework's single-file binding, so a whole document lands as one file under
// the picked directory (or an optional subdirectory of it).
//
// Concurrency rides on each file's `lastModified` ms timestamp, surfaced as the
// per-file revision; the single-file binding compares it across saves to detect
// drift.

import type { StorageAdapter } from "../adapter.ts";
import { createFileStoreAdapter } from "../file-store-adapter.ts";
import type { FileEntry, FileStore } from "../file-store.ts";
import { type Logger, noopLogger } from "../logger.ts";

const SAVE_DEBOUNCE_MS = 500;

function isNotFoundError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotFoundError";
}

// Chrome reports a revoked grant as `NotAllowedError` / `SecurityError`. The
// caller flips to a "Reconnect folder" cue when it sees one.
function isPermissionError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return err.name === "NotAllowedError" || err.name === "SecurityError";
}

export type FolderFileStoreOptions = {
  /**
   * Optional subdirectory of the picked handle to scope this store to. Empty
   * (the default) resolves at the picked-directory root.
   */
  subdirectory?: string;
  /**
   * Fires once when an operation fails because the OS-level permission was
   * revoked between sessions, so the app can clear the in-state handle and
   * surface a reconnect banner without awaiting the next operation.
   */
  onPermissionLost?: () => void;
  logger?: Logger;
};

class FolderFileStore implements FileStore {
  private readonly subdirectory: string;
  private readonly onPermissionLost?: () => void;
  private readonly log: Logger;

  constructor(
    private readonly root: FileSystemDirectoryHandle,
    options: FolderFileStoreOptions = {},
  ) {
    this.subdirectory = options.subdirectory ?? "";
    this.onPermissionLost = options.onPermissionLost;
    this.log = options.logger ?? noopLogger;
  }

  // Resolve the directory handle for a `/`-separated path, optionally creating
  // each segment. Returns null when a segment is missing and `create` is false.
  private async resolveDir(
    segments: string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    let dir = this.root;
    // An empty subdirectory resolves at the picked-directory root, so drop
    // blank segments rather than asking for a directory handle named "".
    for (const segment of [this.subdirectory, ...segments].filter(
      (s) => s.length > 0,
    )) {
      try {
        dir = await dir.getDirectoryHandle(segment, { create });
      } catch (err) {
        if (isNotFoundError(err)) return null;
        this.reportPermission(err);
        throw err;
      }
    }
    return dir;
  }

  private async resolveParent(
    path: string,
    create: boolean,
  ): Promise<{ dir: FileSystemDirectoryHandle; name: string } | null> {
    const segments = path.split("/").filter((s) => s.length > 0);
    const name = segments.pop();
    if (!name) return null;
    const dir = await this.resolveDir(segments, create);
    return dir ? { dir, name } : null;
  }

  private reportPermission(err: unknown): void {
    if (isPermissionError(err)) {
      this.log.error("permission lost", err);
      this.onPermissionLost?.();
    }
  }

  async list(): Promise<FileEntry[]> {
    const dir = await this.resolveDir([], false);
    if (!dir) return [];
    const entries: FileEntry[] = [];
    await this.walk(dir, "", entries);
    return entries;
  }

  private async walk(
    dir: FileSystemDirectoryHandle,
    prefix: string,
    out: FileEntry[],
  ): Promise<void> {
    try {
      for await (const handle of dir.values()) {
        const path = prefix ? `${prefix}/${handle.name}` : handle.name;
        if (handle.kind === "directory") {
          await this.walk(handle, path, out);
        } else {
          const file = await handle.getFile();
          out.push({ path, rev: String(file.lastModified) });
        }
      }
    } catch (err) {
      this.reportPermission(err);
      throw err;
    }
  }

  async read(path: string): Promise<string | null> {
    const parent = await this.resolveParent(path, false);
    if (!parent) return null;
    try {
      const handle = await parent.dir.getFileHandle(parent.name, {
        create: false,
      });
      return await (await handle.getFile()).text();
    } catch (err) {
      if (isNotFoundError(err)) return null;
      this.reportPermission(err);
      throw err;
    }
  }

  async write(path: string, text: string): Promise<void> {
    const parent = await this.resolveParent(path, true);
    if (!parent) throw new Error(`folder: cannot resolve ${path}`);
    try {
      const handle = await parent.dir.getFileHandle(parent.name, {
        create: true,
      });
      const writable = await handle.createWritable({ keepExistingData: false });
      await writable.write(text);
      await writable.close();
    } catch (err) {
      this.reportPermission(err);
      throw err;
    }
  }

  async remove(path: string): Promise<void> {
    const parent = await this.resolveParent(path, false);
    if (!parent) return;
    try {
      await parent.dir.removeEntry(parent.name);
    } catch (err) {
      if (isNotFoundError(err)) return;
      this.reportPermission(err);
      throw err;
    }
  }
}

/** Build the byte-level `FileStore` for a picked directory handle. */
export function createFolderFileStore(
  directoryHandle: FileSystemDirectoryHandle,
  options: FolderFileStoreOptions = {},
): FileStore {
  return new FolderFileStore(directoryHandle, options);
}

export type CreateFolderAdapterOptions = FolderFileStoreOptions & {
  /** Relative path the document is stored under. Defaults to `document.json`. */
  fileName?: string;
};

/**
 * Whole-document folder adapter: stores the document as a single file under the
 * picked directory (or `subdirectory` of it). The local folder never raises
 * network errors, so per-op retry is disabled.
 */
export function createFolderAdapter(
  directoryHandle: FileSystemDirectoryHandle,
  options: CreateFolderAdapterOptions = {},
): StorageAdapter {
  const store = createFolderFileStore(directoryHandle, options);
  return createFileStoreAdapter(store, {
    id: "folder",
    label: "Local folder",
    fileName: options.fileName,
    saveDebounceMs: SAVE_DEBOUNCE_MS,
    logger: options.logger,
    retryDelaysMs: [],
  });
}

export {
  clearDirectoryHandle,
  ensurePermission,
  isFolderBackendAvailable,
  loadDirectoryHandle,
  saveDirectoryHandle,
  type FolderPermissionResult,
} from "./handle-store.ts";
