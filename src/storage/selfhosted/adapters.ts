// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The framework storage contracts over a namespace: `FileStore` (what every
// app's Dropbox / folder / iCloud transport implements) and a single-document
// `StorageAdapter` — with the compare-and-swap happening on the server, so
// the check-then-write race the other backends have is gone.

import {
  AuthError,
  ConflictError,
  type StorageAdapter,
  type StoredSnapshot,
} from "../adapter.ts";
import type { FileEntry, FileStore } from "../file-store.ts";
import { fromUtf8 } from "./crypto.ts";
import { FileConflictError } from "./files.ts";
import type { Namespace } from "./namespace.ts";

export type NamespaceFileStore = FileStore & {
  readBytes(path: string): Promise<Uint8Array | null>;
  writeBytes(path: string, bytes: Uint8Array, mime?: string): Promise<void>;
};

export function createNamespaceFileStore(
  ns: Namespace,
  options: { root?: string } = {},
): NamespaceFileStore {
  const root = options.root?.replace(/^\/+|\/+$/g, "") ?? "";
  const full = (p: string) => (root ? `${root}/${p}` : p);
  return {
    async list(): Promise<FileEntry[]> {
      const files = await ns.files.list(root);
      return files.map((f) => ({
        path: root ? f.path.slice(root.length + 1) : f.path,
        rev: f.rev,
      }));
    },
    async read(path) {
      return (await ns.files.readText(full(path)))?.text ?? null;
    },
    async write(path, text) {
      await ns.files.write(full(path), text, { mime: "text/plain" });
    },
    async remove(path) {
      await ns.files.delete(full(path));
    },
    async readBytes(path) {
      return (await ns.files.read(full(path)))?.bytes ?? null;
    },
    async writeBytes(path, bytes, mime) {
      await ns.files.write(full(path), bytes, { mime });
    },
  };
}

export type NamespaceAdapterOptions = {
  /** The document's path in the namespace. Default `document.json`. */
  fileName?: string;
  /** Default 800 ms — writes are cheap, but keystrokes should coalesce. */
  saveDebounceMs?: number;
  label?: string;
};

export function createNamespaceAdapter(
  ns: Namespace,
  options: NamespaceAdapterOptions = {},
): StorageAdapter {
  const fileName = options.fileName ?? "document.json";

  async function load(): Promise<StoredSnapshot | null> {
    const r = await ns.files.readText(fileName);
    return r ? { text: r.text, revision: r.info.rev } : null;
  }

  async function save(
    text: string,
    baseRevision?: string,
  ): Promise<StoredSnapshot> {
    try {
      const info = await ns.files.write(fileName, text, {
        mime: "application/json",
        ...(baseRevision !== undefined ? { ifRev: baseRevision } : {}),
      });
      return { text, revision: info.rev };
    } catch (err) {
      if (!(err instanceof FileConflictError)) throw err;
      const remote = await ns.files.read(fileName);
      if (!remote) {
        // Deleted remotely: recreate from what we have.
        const info = await ns.files.write(fileName, text, {
          mime: "application/json",
          ifAbsent: true,
        });
        return { text, revision: info.rev };
      }
      throw new ConflictError({
        text: fromUtf8(remote.bytes),
        revision: remote.info.rev,
      });
    }
  }

  async function getRevision(): Promise<string | null> {
    return (await ns.files.stat(fileName))?.rev ?? null;
  }

  async function probe(): Promise<boolean> {
    try {
      await ns.transport.request("GET", `/v1/namespaces/${ns.id}`);
      return true;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      return false;
    }
  }

  function watch(onRemoteChange: (s: StoredSnapshot) => void): () => void {
    let last: string | null = null;
    let busy = false;
    void getRevision()
      .then((r) => (last = r))
      .catch(() => {});
    return ns.watch(async () => {
      if (busy) return;
      busy = true;
      try {
        const rev = await getRevision();
        if (rev !== null && rev !== last) {
          last = rev;
          const snap = await load();
          if (snap) onRemoteChange(snap);
        }
      } catch {
        // the next event retries
      } finally {
        busy = false;
      }
    });
  }

  return {
    id: "selfhosted",
    label: options.label ?? "Self-hosted",
    capabilities: new Set(["getRevision", "probe", "watch"]),
    saveDebounceMs: options.saveDebounceMs ?? 800,
    load,
    save,
    getRevision,
    probe,
    watch,
  };
}
