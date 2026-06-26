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
