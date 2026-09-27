// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Encrypted files in a namespace. A file's path is sealed segment by segment
// (so folders still list by prefix), its bytes under a fresh content id, and
// its metadata — the plaintext path, the content id, size, mtime, type,
// tags — sealed and bound to the encrypted path. A server that moves or swaps
// blobs produces a decryption failure, never wrong data.

import {
  aad,
  b64u,
  fromUtf8,
  nameEpoch,
  randomBytes,
  unb64u,
  utf8,
} from "./crypto.ts";
import { DecryptError, NotFoundError, PreconditionError } from "./errors.ts";
import type { Namespace } from "./namespace.ts";

export type FileInfo = {
  path: string;
  fileId: string;
  rev: string;
  /** Plaintext size in bytes. */
  size: number;
  mtime: number;
  mime?: string;
  tags?: string[];
  /** The encrypted path the server knows the file by. */
  token: string;
};

type FileMeta = { v: 1; path: string; cid: string; size: number; mtime: number; mime?: string; tags?: string[] };

type RawEntry = { path: string; fileId: string; rev: string; size: number; meta: string | null };

export type WriteOptions = { ifRev?: string; ifAbsent?: boolean; mime?: string; tags?: string[]; mtime?: number };

/** A write lost a compare-and-swap; `current` is the server's version (null = absent). */
export class FileConflictError extends Error {
  constructor(readonly current: FileInfo | null) {
    super("the file changed on the server");
    this.name = "FileConflictError";
  }
}

const MULTIPART_THRESHOLD = 8 * 1024 * 1024;
const PART_SIZE = 8 * 1024 * 1024;

export class NamespaceFiles {
  constructor(private readonly ns: Namespace) {}

  /** Seal a file for upload: content, metadata and the encrypted path. */
  async sealFile(path: string, data: Uint8Array, opts: WriteOptions = {}): Promise<{ encPath: string; content: Uint8Array; meta: string }> {
    const encPath = await this.ns.encryptPath(path);
    const cid = b64u(randomBytes(16));
    const meta: FileMeta = {
      v: 1,
      path,
      cid,
      size: data.byteLength,
      mtime: opts.mtime ?? Date.now(),
      ...(opts.mime ? { mime: opts.mime } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
    };
    return {
      encPath,
      content: await this.ns.seal(data, aad.file(this.ns.id, cid)),
      meta: b64u(await this.ns.seal(utf8(JSON.stringify(meta)), aad.meta(this.ns.id, encPath))),
    };
  }

  private async openMeta(encPath: string, meta: string): Promise<FileMeta> {
    const m = JSON.parse(fromUtf8(await this.ns.open(unb64u(meta), aad.meta(this.ns.id, encPath)))) as FileMeta;
    if (m.v !== 1) throw new DecryptError("unknown file metadata version");
    return m;
  }

  async decodeEntry(e: RawEntry): Promise<FileInfo> {
    if (!e.meta) throw new DecryptError("file has no metadata");
    const m = await this.openMeta(e.path, e.meta);
    return {
      path: m.path,
      fileId: e.fileId,
      rev: e.rev,
      size: m.size,
      mtime: m.mtime,
      ...(m.mime ? { mime: m.mime } : {}),
      ...(m.tags ? { tags: m.tags } : {}),
      token: e.path,
    };
  }

  /** Files under `prefix` (all of them by default), decrypted, sorted by path. */
  async list(prefix = "", opts: { recursive?: boolean } = {}): Promise<FileInfo[]> {
    const recursive = opts.recursive !== false;
    const out = new Map<string, FileInfo>();
    // Older-epoch files (mid-rotation) live under other encrypted prefixes.
    const prefixes = prefix === "" ? [""] : await Promise.all(this.ns.epochs().map((e) => this.ns.encryptPath(prefix, e)));
    for (const encPrefix of prefixes) {
      let cursor: string | undefined;
      do {
        const page = await this.ns.transport.json<{ entries: RawEntry[]; cursor?: string; seq: string }>("GET", `${this.ns.base}/files`, {
          query: { prefix: encPrefix || undefined, recursive: recursive ? 1 : undefined, cursor, limit: 1000 },
        });
        this.ns.observe(page.seq);
        for (const e of page.entries) {
          try {
            const info = await this.decodeEntry(e);
            const prev = out.get(info.path);
            if (!prev || nameEpoch(prev.token.split("/")[0]!) < nameEpoch(info.token.split("/")[0]!)) out.set(info.path, info);
          } catch (err) {
            this.ns.ctx.log.warn(`skipping an undecryptable file entry`, err);
          }
        }
        cursor = page.cursor;
      } while (cursor);
    }
    return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  /** Find a file's encrypted path, trying older key epochs (mid-rotation). */
  private async locate(path: string): Promise<{ encPath: string; res: Response } | null> {
    for (const epoch of this.ns.epochs()) {
      const encPath = await this.ns.encryptPath(path, epoch);
      try {
        const res = await this.ns.transport.request("GET", `${this.ns.base}/files/${encPath}`);
        return { encPath, res };
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
    }
    return null;
  }

  async stat(path: string): Promise<FileInfo | null> {
    for (const epoch of this.ns.epochs()) {
      const encPath = await this.ns.encryptPath(path, epoch);
      try {
        const res = await this.ns.transport.request("HEAD", `${this.ns.base}/files/${encPath}`);
        return this.fromHeaders(encPath, res);
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
    }
    return null;
  }

  private async fromHeaders(encPath: string, res: Response): Promise<FileInfo> {
    const rev = (res.headers.get("etag") ?? "").replaceAll('"', "");
    return this.decodeEntry({
      path: encPath,
      fileId: res.headers.get("x-file-id") ?? "",
      rev,
      size: Number(res.headers.get("content-length") ?? 0),
      meta: res.headers.get("x-meta"),
    });
  }

  /** Read and decrypt a file, or null when it does not exist. */
  async read(path: string): Promise<{ bytes: Uint8Array; info: FileInfo } | null> {
    const found = await this.locate(path);
    if (!found) return null;
    const info = await this.fromHeaders(found.encPath, found.res);
    if (info.path !== path) throw new DecryptError("file metadata does not match its path");
    const meta = await this.openMeta(found.encPath, found.res.headers.get("x-meta")!);
    const sealed = new Uint8Array(await found.res.arrayBuffer());
    const bytes = await this.ns.open(sealed, aad.file(this.ns.id, meta.cid));
    return { bytes, info };
  }

  async readText(path: string): Promise<{ text: string; info: FileInfo } | null> {
    const r = await this.read(path);
    return r ? { text: fromUtf8(r.bytes), info: r.info } : null;
  }

  /**
   * Write (create or replace) a file. `ifRev` / `ifAbsent` make it a
   * compare-and-swap: a lost race throws `FileConflictError` with the
   * server's current version instead of overwriting it.
   */
  async write(path: string, data: Uint8Array | string, opts: WriteOptions = {}): Promise<FileInfo> {
    const bytes = typeof data === "string" ? utf8(data) : data;
    return this.ns.withEpochRetry(async () => {
      const sealed = await this.sealFile(path, bytes, opts);
      try {
        const out =
          sealed.content.byteLength > MULTIPART_THRESHOLD
            ? await this.upload(sealed, opts)
            : await this.ns.transport.json<{ rev: string; fileId: string; seq: string }>("PUT", `${this.ns.base}/files/${sealed.encPath}`, {
                body: sealed.content,
                headers: {
                  "X-Meta": sealed.meta,
                  ...(opts.ifRev ? { "If-Match": `"${opts.ifRev}"` } : {}),
                  ...(opts.ifAbsent ? { "If-None-Match": "*" } : {}),
                },
              });
        this.ns.observe(out.seq);
        return this.decodeEntry({ path: sealed.encPath, fileId: out.fileId, rev: out.rev, size: sealed.content.byteLength, meta: sealed.meta });
      } catch (err) {
        if (err instanceof PreconditionError) throw new FileConflictError(await this.currentOf(err.current));
        throw err;
      }
    });
  }

  private async currentOf(current: Record<string, unknown> | null): Promise<FileInfo | null> {
    if (!current || typeof current.meta !== "string") return null;
    try {
      return await this.decodeEntry(current as unknown as RawEntry);
    } catch {
      return null;
    }
  }

  private async upload(sealed: { encPath: string; content: Uint8Array; meta: string }, opts: WriteOptions) {
    const t = this.ns.transport;
    const { uploadId } = await t.json<{ uploadId: string }>("POST", `${this.ns.base}/uploads`);
    try {
      for (let i = 0, n = 1; i < sealed.content.byteLength; i += PART_SIZE, n++) {
        await t.json("PUT", `${this.ns.base}/uploads/${uploadId}/parts/${n}`, { body: sealed.content.subarray(i, i + PART_SIZE) });
      }
      return await t.json<{ rev: string; fileId: string; seq: string }>("POST", `${this.ns.base}/uploads/${uploadId}/commit`, {
        json: { path: sealed.encPath, meta: sealed.meta, ifMatch: opts.ifRev, ifNoneMatch: opts.ifAbsent },
      });
    } catch (err) {
      await t.request("DELETE", `${this.ns.base}/uploads/${uploadId}`).catch(() => {});
      throw err;
    }
  }

  /** Delete to the trash. Returns false when there was nothing to delete. */
  async delete(path: string, opts: { ifRev?: string } = {}): Promise<boolean> {
    const info = await this.stat(path);
    if (!info) return false;
    try {
      const out = await this.ns.transport.json<{ seq: string }>("DELETE", `${this.ns.base}/files/${info.token}`, {
        headers: opts.ifRev ? { "If-Match": `"${opts.ifRev}"` } : {},
      });
      this.ns.observe(out.seq);
      return true;
    } catch (err) {
      if (err instanceof NotFoundError) return false;
      if (err instanceof PreconditionError) throw new FileConflictError(await this.currentOf(err.current));
      throw err;
    }
  }

  /** Rename / move, keeping the file's identity and history. */
  async move(from: string, to: string, opts: { ifRev?: string; overwrite?: boolean } = {}): Promise<FileInfo> {
    const src = await this.stat(from);
    if (!src) throw new NotFoundError(`no file at ${from}`);
    return this.relocate("files:move", src, to, { ifMatch: opts.ifRev, overwrite: opts.overwrite === true });
  }

  /** Copy to a new file (the server shares the bytes; the copy gets its own identity). */
  async copy(from: string, to: string): Promise<FileInfo> {
    const src = await this.stat(from);
    if (!src) throw new NotFoundError(`no file at ${from}`);
    return this.relocate("files:copy", src, to, {});
  }

  private async relocate(action: string, src: FileInfo, to: string, extra: Record<string, unknown>): Promise<FileInfo> {
    return this.ns.withEpochRetry(async () => {
      const encTo = await this.ns.encryptPath(to);
      const old = await this.openMeta(src.token, (await this.rawMeta(src.token))!);
      const meta: FileMeta = { ...old, path: to };
      const sealedMeta = b64u(await this.ns.seal(utf8(JSON.stringify(meta)), aad.meta(this.ns.id, encTo)));
      try {
        const out = await this.ns.transport.json<{ rev: string; fileId: string; seq: string }>("POST", `${this.ns.base}/${action}`, {
          json: { from: src.token, to: encTo, meta: sealedMeta, ...extra },
        });
        this.ns.observe(out.seq);
        return { ...src, path: to, token: encTo, rev: out.rev, fileId: out.fileId };
      } catch (err) {
        if (err instanceof PreconditionError) throw new FileConflictError(await this.currentOf(err.current));
        throw err;
      }
    });
  }

  private async rawMeta(encPath: string): Promise<string | null> {
    const res = await this.ns.transport.request("HEAD", `${this.ns.base}/files/${encPath}`);
    return res.headers.get("x-meta");
  }

  /** Earlier versions of a file, newest first. */
  async history(path: string): Promise<{ rev: string; size: number; mtime: number; createdAt: number }[]> {
    const info = await this.stat(path);
    if (!info) return [];
    const { revisions } = await this.ns.transport.json<{
      revisions: { fileId: string; rev: string; path: string; size: number; meta: string | null; createdAt: number }[];
    }>("GET", `${this.ns.base}/history/${info.token}`);
    const out = [];
    for (const r of revisions) {
      const m = r.meta ? await this.openMeta(r.path, r.meta).catch(() => null) : null;
      out.push({ rev: r.rev, size: m?.size ?? r.size, mtime: m?.mtime ?? r.createdAt, createdAt: r.createdAt });
    }
    return out;
  }

  /** The bytes of an earlier version. */
  async readRevision(path: string, rev: string): Promise<Uint8Array> {
    const info = await this.stat(path);
    if (!info) throw new NotFoundError(`no file at ${path}`);
    const { revisions } = await this.ns.transport.json<{ revisions: { rev: string; path: string; meta: string | null }[] }>(
      "GET",
      `${this.ns.base}/history/${info.token}`,
    );
    const r = revisions.find((x) => x.rev === rev);
    if (!r?.meta) throw new NotFoundError(`no revision ${rev} of ${path}`);
    const meta = await this.openMeta(r.path, r.meta);
    const res = await this.ns.transport.request("GET", `${this.ns.base}/revisions/${info.fileId}/${rev}`);
    return this.ns.open(new Uint8Array(await res.arrayBuffer()), aad.file(this.ns.id, meta.cid));
  }

  /** Make an earlier version current again (as a new version). */
  async restore(path: string, rev: string): Promise<FileInfo> {
    const bytes = await this.readRevision(path, rev);
    const cur = await this.stat(path);
    return this.write(path, bytes, { ifRev: cur?.rev, mime: cur?.mime, tags: cur?.tags });
  }

  /** Deleted files, newest first. */
  async trash(): Promise<{ fileId: string; path: string; size: number; deletedAt: number }[]> {
    const { entries } = await this.ns.transport.json<{
      entries: { fileId: string; path: string; rev: string; size: number; meta: string | null; deletedAt: number }[];
    }>("GET", `${this.ns.base}/trash`);
    const out = [];
    for (const e of entries) {
      const m = e.meta ? await this.openMeta(e.path, e.meta).catch(() => null) : null;
      out.push({ fileId: e.fileId, path: m?.path ?? (await this.ns.decryptPath(e.path)), size: m?.size ?? e.size, deletedAt: e.deletedAt });
    }
    return out;
  }

  async restoreTrash(fileId: string): Promise<void> {
    const out = await this.ns.transport.json<{ seq: string }>("POST", `${this.ns.base}/trash:restore`, { json: { fileId } });
    this.ns.observe(out.seq);
  }

  async purgeTrash(fileId: string): Promise<void> {
    await this.ns.transport.request("DELETE", `${this.ns.base}/trash/${encodeURIComponent(fileId)}`);
  }
}
