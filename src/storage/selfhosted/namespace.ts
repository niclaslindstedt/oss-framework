// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A namespace handle: one app's bucket on the server, with its own key
// (per epoch), encrypted files and rows, a change feed, sharing, and key
// rotation. Plaintext never leaves this object — names, values, metadata
// and file contents are sealed before they reach the transport.

import type { Logger } from "../logger.ts";
import type { StorageAdapter } from "../adapter.ts";
import type { FileStore } from "../file-store.ts";
import {
  aad,
  b64u,
  decryptName,
  encryptName,
  fromUtf8,
  type NamespaceKeySet,
  nameEpoch,
  openEnvelope,
  randomBytes,
  sealEnvelope,
  sealWithKey,
  secretCode,
  secretKey,
  unb64u,
  utf8,
} from "./crypto.ts";
import { ApiRequestError, ForbiddenError, KeysMissingError } from "./errors.ts";
import { type FileInfo, NamespaceFiles } from "./files.ts";
import { formatPayload } from "./payload.ts";
import { RecordsApi } from "./records-api.ts";
import { RecordStore, type RecordStoreOptions } from "./record-store.ts";
import type { Transport } from "./transport.ts";
import type { SelfHostedClient } from "./client.ts";
import { inviteContext } from "./client.ts";
import {
  createNamespaceAdapter,
  createNamespaceFileStore,
  type NamespaceAdapterOptions,
  type NamespaceFileStore,
} from "./adapters.ts";
import {
  createRowDocumentAdapter,
  type RowDocumentOptions,
} from "./row-document.ts";
import { rotateNamespaceKey } from "./rotation.ts";

export type NsRole = "owner" | "editor" | "viewer";

/** Whatever the app keeps about a namespace — sealed like everything else. */
export type NamespaceMeta = { name: string } & Record<string, unknown>;

export type RawNamespace = {
  id: string;
  app: string;
  role: NsRole;
  ownerAccountId: string;
  epoch: number;
  meta: string;
  metaRev: string;
  seq: string;
  usedBytes: number;
  createdAt: number;
  keys: Record<string, string>;
};

export type NamespaceInfo = {
  id: string;
  app: string;
  role: NsRole;
  epoch: number;
  seq: number;
  ownerAccountId: string;
  usedBytes: number;
  keys: Record<string, string>;
  meta: NamespaceMeta;
};

export type Member = {
  accountId: string;
  name: string;
  role: NsRole;
  hasKey: boolean;
  aekPublic: string | null;
};

export type Change =
  | {
      kind: "file";
      path: string;
      rev: string;
      deleted: boolean;
      file?: FileInfo;
    }
  | {
      kind: "record";
      collection: string;
      key: string;
      rev: string;
      deleted: boolean;
      value?: unknown;
    }
  | { kind: "namespace"; rev: string; epoch: number; meta: NamespaceMeta }
  | { kind: "members"; rev: string };

type RawChange =
  | {
      kind: "file";
      path: string;
      fileId: string;
      rev: string;
      size: number;
      meta: string | null;
      deleted: boolean;
    }
  | {
      kind: "record";
      collection: string;
      key: string;
      rev: string;
      value: string | null;
      deleted: boolean;
    }
  | { kind: "namespace"; rev: string; meta: string; epoch: number }
  | { kind: "members"; rev: string };

export type PlainOp =
  | {
      op: "put";
      collection: string;
      key: string;
      value: unknown;
      ifRev?: string;
      ifAbsent?: boolean;
    }
  | { op: "delete"; collection: string; key: string; ifRev?: string }
  | { op: "check"; collection: string; key: string; rev: string }
  | {
      op: "file.put";
      path: string;
      data: Uint8Array | string;
      ifRev?: string;
      ifAbsent?: boolean;
      mime?: string;
    }
  | { op: "file.delete"; path: string; ifRev?: string };

export type BatchResult =
  | { ok: true; rev: string }
  | { ok: false; error: string; message: string; current?: unknown };

export type NamespaceContext = {
  client: SelfHostedClient;
  transport: Transport;
  accountId: string;
  serverUrl: string;
  serverName?: string;
  log: Logger;
};

export function isStaleEpoch(err: unknown): boolean {
  return (
    err instanceof ApiRequestError &&
    err.status === 400 &&
    err.details.reason === "stale_epoch"
  );
}

export class Namespace {
  info: NamespaceInfo;
  readonly files: NamespaceFiles;

  constructor(
    readonly ctx: NamespaceContext,
    info: NamespaceInfo,
  ) {
    this.info = info;
    this.files = new NamespaceFiles(this);
  }

  get id(): string {
    return this.info.id;
  }
  get app(): string {
    return this.info.app;
  }
  get role(): NsRole {
    return this.info.role;
  }
  get epoch(): number {
    return this.info.epoch;
  }
  get meta(): NamespaceMeta {
    return this.info.meta;
  }
  get transport(): Transport {
    return this.ctx.transport;
  }
  get base(): string {
    return `/v1/ns/${this.id}`;
  }

  keys(epoch: number = this.epoch): Promise<NamespaceKeySet> {
    return this.ctx.client.keysFor(this.id, epoch, this.info.keys);
  }

  /** Epochs this device can decrypt, newest first. */
  epochs(): number[] {
    return Object.keys(this.info.keys)
      .map(Number)
      .filter((e) => e <= this.epoch)
      .sort((a, b) => b - a);
  }

  observe(seq: number | string): void {
    this.ctx.client.observeSeq(this.id, Number(seq));
    if (Number(seq) > this.info.seq) this.info.seq = Number(seq);
  }

  async refresh(): Promise<void> {
    const raw = await this.transport.json<RawNamespace>(
      "GET",
      `/v1/namespaces/${this.id}`,
    );
    this.observe(raw.seq);
    this.info = {
      id: raw.id,
      app: raw.app,
      role: raw.role,
      epoch: raw.epoch,
      seq: Number(raw.seq),
      ownerAccountId: raw.ownerAccountId,
      usedBytes: raw.usedBytes,
      keys: raw.keys,
      meta: await this.ctx.client.decryptMeta(raw),
    };
  }

  /** Run a write; if someone rotated the key meanwhile, refresh and retry once. */
  async withEpochRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!isStaleEpoch(err)) throw err;
      await this.refresh();
      return fn();
    }
  }

  // ---- names and values ---------------------------------------------------------

  async encryptName(name: string, epoch = this.epoch): Promise<string> {
    return encryptName(await this.keys(epoch), name);
  }

  async decryptName(token: string): Promise<string> {
    return decryptName(await this.keys(nameEpoch(token)), token);
  }

  async encryptPath(path: string, epoch = this.epoch): Promise<string> {
    const segs = splitPath(path);
    const keys = await this.keys(epoch);
    return (await Promise.all(segs.map((s) => encryptName(keys, s)))).join("/");
  }

  async decryptPath(tokens: string): Promise<string> {
    return (
      await Promise.all(tokens.split("/").map((t) => this.decryptName(t)))
    ).join("/");
  }

  async seal(plain: Uint8Array, aadText: string): Promise<Uint8Array> {
    return sealEnvelope(await this.keys(), plain, aadText);
  }

  async open(sealed: Uint8Array, aadText: string): Promise<Uint8Array> {
    return openEnvelope((e) => this.keys(e), sealed, aadText);
  }

  // ---- metadata -------------------------------------------------------------------

  async updateMeta(meta: NamespaceMeta): Promise<void> {
    await this.withEpochRetry(async () => {
      const sealed = b64u(
        await this.seal(utf8(JSON.stringify(meta)), aad.nsmeta(this.id)),
      );
      const raw = await this.transport.json<RawNamespace>(
        "PATCH",
        `/v1/namespaces/${this.id}`,
        { json: { meta: sealed } },
      );
      this.observe(raw.seq);
      this.info.meta = meta;
    });
  }

  // ---- rows -------------------------------------------------------------------------

  records<T = unknown>(collection: string): RecordsApi<T> {
    return new RecordsApi<T>(this, collection);
  }

  recordStore<T = unknown>(
    collection: string,
    options: RecordStoreOptions<T> = {},
  ): RecordStore<T> {
    return new RecordStore<T>(this, collection, options);
  }

  /** Every collection in the namespace (names decrypted) with its live row count. */
  async collections(): Promise<
    { collection: string; rows: number; epoch: number; token: string }[]
  > {
    const { collections } = await this.transport.json<{
      collections: { collection: string; rows: number }[];
    }>("GET", `${this.base}/collections`);
    const out = [];
    for (const c of collections) {
      out.push({
        collection: await this.decryptName(c.collection),
        rows: c.rows,
        epoch: nameEpoch(c.collection),
        token: c.collection,
      });
    }
    return out;
  }

  /** Several writes at one sequence number; `atomic` (default) = all or nothing. */
  async batch(
    ops: PlainOp[],
    opts: { atomic?: boolean } = {},
  ): Promise<{ seq: string; results: BatchResult[] }> {
    return this.withEpochRetry(async () => {
      const wire = [];
      for (const op of ops) wire.push(await this.encodeOp(op));
      const out = await this.transport.json<{
        seq: string;
        results: BatchResult[];
      }>("POST", `${this.base}/batch`, {
        json: { atomic: opts.atomic !== false, ops: wire },
      });
      this.observe(out.seq);
      return out;
    });
  }

  async encodeOp(op: PlainOp): Promise<Record<string, unknown>> {
    switch (op.op) {
      case "put":
      case "delete":
      case "check": {
        const collection = await this.encryptName(op.collection);
        const key = await this.encryptName(op.key);
        if (op.op === "put") {
          const value = b64u(
            await this.seal(
              utf8(JSON.stringify(op.value)),
              aad.record(this.id, collection, key),
            ),
          );
          return {
            op: "put",
            collection,
            key,
            value,
            ifRev: op.ifRev,
            ifAbsent: op.ifAbsent,
          };
        }
        return op.op === "delete"
          ? { op: "delete", collection, key, ifRev: op.ifRev }
          : { op: "check", collection, key, rev: op.rev };
      }
      case "file.put": {
        const sealed = await this.files.sealFile(
          op.path,
          typeof op.data === "string" ? utf8(op.data) : op.data,
          { mime: op.mime },
        );
        return {
          op: "file.put",
          path: sealed.encPath,
          content: b64u(sealed.content),
          meta: sealed.meta,
          ifRev: op.ifRev,
          ifAbsent: op.ifAbsent,
        };
      }
      case "file.delete":
        return {
          op: "file.delete",
          path: await this.encryptPath(op.path),
          ifRev: op.ifRev,
        };
    }
  }

  // ---- change feed ---------------------------------------------------------------------

  /** What changed since `since` (0 = everything still in the feed), decrypted. */
  async changes(
    since: number,
    opts: { waitSeconds?: number; limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ seq: number; changes: Change[]; more: boolean }> {
    const raw = await this.transport.json<{
      seq: string;
      changes: RawChange[];
      more: boolean;
    }>("GET", `${this.base}/changes`, {
      query: { since, wait: opts.waitSeconds, limit: opts.limit },
      signal: opts.signal,
    });
    this.observe(raw.seq);
    const changes: Change[] = [];
    for (const c of raw.changes) {
      try {
        changes.push(await this.decodeChange(c));
      } catch (err) {
        if (err instanceof KeysMissingError) throw err;
        this.ctx.log.warn(`skipping an undecryptable ${c.kind} change`, err);
      }
    }
    return { seq: Number(raw.seq), changes, more: raw.more };
  }

  private async decodeChange(c: RawChange): Promise<Change> {
    switch (c.kind) {
      case "file": {
        if (c.deleted || !c.meta)
          return {
            kind: "file",
            path: await this.decryptPath(c.path),
            rev: c.rev,
            deleted: true,
          };
        const file = await this.files.decodeEntry({
          path: c.path,
          fileId: c.fileId,
          rev: c.rev,
          size: c.size,
          meta: c.meta,
        });
        return {
          kind: "file",
          path: file.path,
          rev: c.rev,
          deleted: false,
          file,
        };
      }
      case "record": {
        const collection = await this.decryptName(c.collection);
        const key = await this.decryptName(c.key);
        if (c.deleted || c.value === null)
          return { kind: "record", collection, key, rev: c.rev, deleted: true };
        const plain = await this.open(
          unb64u(c.value),
          aad.record(this.id, c.collection, c.key),
        );
        return {
          kind: "record",
          collection,
          key,
          rev: c.rev,
          deleted: false,
          value: JSON.parse(fromUtf8(plain)),
        };
      }
      case "namespace": {
        const plain = await this.open(unb64u(c.meta), aad.nsmeta(this.id));
        const meta = JSON.parse(fromUtf8(plain)) as NamespaceMeta;
        if (c.epoch > this.info.epoch) await this.refresh();
        this.info.meta = meta;
        return { kind: "namespace", rev: c.rev, epoch: c.epoch, meta };
      }
      case "members":
        return { kind: "members", rev: c.rev };
    }
  }

  /** Call `listener` whenever the server says this namespace moved. */
  watch(listener: (seq: number) => void): () => void {
    return this.ctx.client.subscribe((e) => {
      if (e.type === "ns" && e.ns === this.id) listener(e.seq);
    });
  }

  // ---- sharing -------------------------------------------------------------------------

  async members(): Promise<Member[]> {
    return (
      await this.transport.json<{ members: Member[] }>(
        "GET",
        `/v1/namespaces/${this.id}/members`,
      )
    ).members;
  }

  /**
   * Invite someone to THIS namespace only. The returned payload (QR code or
   * link) carries a secret the server never sees; the namespace keys travel
   * sealed under it.
   */
  async invite(
    opts: {
      role?: "editor" | "viewer";
      ttlSeconds?: number;
      maxUses?: number;
      appUrl?: string;
    } = {},
  ): Promise<{ payload: string; inviteId: string; expiresAt: number }> {
    if (this.role !== "owner")
      throw new ForbiddenError("only owners can invite");
    const x = randomBytes(32);
    const epochs: Record<string, string> = {};
    for (const [e, nk] of Object.entries(
      await this.ctx.client.namespaceKeyBytes(this.id),
    ))
      epochs[e] = b64u(nk);
    const sealed = await sealWithKey(
      await secretKey(x),
      utf8(JSON.stringify({ epochs })),
      inviteContext(this.id),
    );
    const role = opts.role ?? "viewer";
    const r = await this.transport.json<{
      inviteId: string;
      expiresAt: number;
    }>("POST", `/v1/namespaces/${this.id}/invites`, {
      json: {
        role,
        code: await secretCode(x),
        payload: sealed,
        ttlSeconds: opts.ttlSeconds,
        maxUses: opts.maxUses,
      },
    });
    return {
      payload: formatPayload(
        {
          kind: "invite",
          server: this.ctx.serverUrl,
          secret: x,
          role,
          name: this.ctx.serverName,
        },
        opts.appUrl,
      ),
      ...r,
    };
  }

  async invites(): Promise<
    {
      id: string;
      role: string;
      expiresAt: number;
      uses: number;
      maxUses: number;
      revoked: boolean;
    }[]
  > {
    return (
      await this.transport.json<{ invites: never[] }>(
        "GET",
        `/v1/namespaces/${this.id}/invites`,
      )
    ).invites;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.transport.request(
      "DELETE",
      `/v1/namespaces/${this.id}/invites/${encodeURIComponent(inviteId)}`,
    );
  }

  async setRole(accountId: string, role: NsRole): Promise<void> {
    await this.transport.request(
      "PATCH",
      `/v1/namespaces/${this.id}/members/${encodeURIComponent(accountId)}`,
      { json: { role } },
    );
  }

  /** Remove a member; by default also rotate the key so they cannot read anything new. */
  async removeMember(
    accountId: string,
    opts: { rotate?: boolean } = {},
  ): Promise<void> {
    await this.transport.request(
      "DELETE",
      `/v1/namespaces/${this.id}/members/${encodeURIComponent(accountId)}`,
    );
    if (opts.rotate !== false) await this.rotateKey();
  }

  async leave(): Promise<void> {
    await this.transport.request(
      "DELETE",
      `/v1/namespaces/${this.id}/members/${encodeURIComponent(this.ctx.accountId)}`,
    );
  }

  /** Delete the namespace and everything in it, for every member. */
  async delete(): Promise<void> {
    await this.transport.request("DELETE", `/v1/namespaces/${this.id}`);
  }

  /**
   * Start a new key epoch wrapped only to the current members, then
   * re-encrypt every file, row and the namespace metadata under it.
   */
  async rotateKey(): Promise<{ epoch: number; files: number; rows: number }> {
    return rotateNamespaceKey(this);
  }

  // ---- storage-contract bindings --------------------------------------------------------

  /** The framework `FileStore` over this namespace (drop-in for Dropbox's). */
  fileStore(options: { root?: string } = {}): NamespaceFileStore & FileStore {
    return createNamespaceFileStore(this, options);
  }

  /** A single-document `StorageAdapter` with atomic conflict detection and live updates. */
  adapter(options: NamespaceAdapterOptions = {}): StorageAdapter {
    return createNamespaceAdapter(this, options);
  }

  /** A `StorageAdapter` that stores a JSON document as rows and merges per row. */
  rowDocumentAdapter(options: RowDocumentOptions): StorageAdapter {
    return createRowDocumentAdapter(this, options);
  }
}

export function splitPath(path: string): string[] {
  const segs = path.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) {
    throw new Error(
      `invalid path "${path}": use non-empty segments without "." or ".."`,
    );
  }
  return segs;
}
