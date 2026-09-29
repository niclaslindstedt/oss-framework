// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The small contract a file-based backend implements so a higher-order
// adapter can store a document as one or more files. Each backend — local
// folder, Dropbox, Google Drive — only has to move bytes for a single
// relative path; conflict detection, retry, and the document-shape decisions
// live above this seam (see `./file-store-adapter.ts`, or an app's own
// multi-file binding).
//
// Paths are POSIX-style and relative to the store's root. Each store prepends
// its own root: the folder backend a subdirectory of the picked handle,
// Dropbox `/<root>/…`, Drive `<appFolder>/<subfolder>/…`. The store itself is
// domain-agnostic — it never interprets the bytes it moves.

/** A file's path plus an opaque per-file revision used to detect drift. */
export type FileEntry = {
  path: string;
  /**
   * Backend-defined token that changes when the file's bytes change: a folder
   * mtime, a Dropbox `rev`, a Drive version. Used only to build an aggregate
   * revision — never interpreted.
   */
  rev?: string;
};

export interface FileStore {
  /** Every file under the store's root, with its current revision. */
  list(): Promise<FileEntry[]>;
  /** Read one file's bytes, or null when it doesn't exist. */
  read(path: string): Promise<string | null>;
  /** Write (create or overwrite) one file. */
  write(path: string, text: string): Promise<void>;
  /** Delete one file. A missing file is treated as already gone. */
  remove(path: string): Promise<void>;
}

/**
 * A store that can move binary files too. `FileStore` is text — its `read`
 * decodes UTF-8 and its `write` sends a string — which is right for a
 * document and wrong for a photo or a recording, whose bytes come back
 * mangled by the decoding. A backend that can carry bytes says so by
 * implementing this beside the text pair; the self-hosted namespace store
 * and the Dropbox store both do.
 */
export interface ByteFileStore {
  list(): Promise<FileEntry[]>;
  /** Read one file's bytes, or null when it doesn't exist. */
  readBytes(path: string): Promise<Uint8Array | null>;
  /** Write (create or overwrite) one file's bytes. `mime` is a hint a backend
   *  that keeps content types may use; most infer one from the path. */
  writeBytes(path: string, bytes: Uint8Array, mime?: string): Promise<void>;
  /** Delete one file. A missing file is treated as already gone. */
  remove(path: string): Promise<void>;
}

/** A store confined to one folder of another: `prefix/` is prepended on the
 *  way in and stripped on the way out, and `list` shows only what is under
 *  it. What keeps two things that share a backend — two libraries' media,
 *  the document and the files beside it — out of each other's prune. */
export function scopedByteStore(
  store: ByteFileStore,
  prefix: string,
): ByteFileStore {
  const root = prefix.replace(/^\/+|\/+$/g, "");
  const head = root ? `${root}/` : "";
  return {
    async list() {
      const entries = await store.list();
      return entries
        .filter((entry) => entry.path.startsWith(head))
        .map((entry) => ({ ...entry, path: entry.path.slice(head.length) }));
    },
    readBytes: (path) => store.readBytes(head + path),
    writeBytes: (path, bytes, mime) =>
      store.writeBytes(head + path, bytes, mime),
    remove: (path) => store.remove(head + path),
  };
}

/** A store in memory, for tests and for a demo that must touch nothing. The
 *  revision is a counter per write. */
export function memoryByteStore(): ByteFileStore & {
  files: Map<string, Uint8Array>;
} {
  const files = new Map<string, Uint8Array>();
  const revs = new Map<string, number>();
  return {
    files,
    async list() {
      return Array.from(files.keys()).map((path) => ({
        path,
        rev: String(revs.get(path) ?? 0),
      }));
    },
    async readBytes(path) {
      const bytes = files.get(path);
      return bytes ? bytes.slice() : null;
    },
    async writeBytes(path, bytes) {
      files.set(path, bytes.slice());
      revs.set(path, (revs.get(path) ?? 0) + 1);
    },
    async remove(path) {
      files.delete(path);
      revs.delete(path);
    },
  };
}
