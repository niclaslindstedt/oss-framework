// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Rows in one collection — the encrypted key-value store. Each row has its
// own revision, so conditional writes conflict per row, not per document.

import { aad, b64u, fromUtf8, nameEpoch, unb64u, utf8 } from "./crypto.ts";
import { NotFoundError, PreconditionError } from "./errors.ts";
import type { Namespace } from "./namespace.ts";

export type Row<T> = {
  key: string;
  value: T;
  rev: string;
  updatedAt: number;
  epoch: number;
};

/** A conditional row write lost; `current` is the server's row (null = absent / deleted). */
export class RowConflictError<T = unknown> extends Error {
  constructor(
    readonly key: string,
    readonly current:
      | (Row<T> & { deleted?: false })
      | { key: string; rev: string; deleted: true }
      | null,
  ) {
    super(`row ${key} changed on the server`);
    this.name = "RowConflictError";
  }
}

type RawRow = {
  collection: string;
  key: string;
  rev: string;
  value: string | null;
  deleted: boolean;
  updatedAt: number;
};

export class RecordsApi<T = unknown> {
  constructor(
    readonly ns: Namespace,
    readonly collection: string,
  ) {}

  private url(cTok: string, kTok?: string): string {
    return `${this.ns.base}/records/${cTok}${kTok ? `/${kTok}` : ""}`;
  }

  /** Decrypt a raw row as the server returned it. */
  async decode(
    raw: RawRow,
  ): Promise<Row<T> | { key: string; rev: string; deleted: true }> {
    const key = await this.ns.decryptName(raw.key);
    if (raw.value === null || raw.deleted)
      return { key, rev: raw.rev, deleted: true };
    const plain = await this.ns.open(
      unb64u(raw.value),
      aad.record(this.ns.id, raw.collection, raw.key),
    );
    return {
      key,
      value: JSON.parse(fromUtf8(plain)) as T,
      rev: raw.rev,
      updatedAt: raw.updatedAt,
      epoch: nameEpoch(raw.key),
    };
  }

  async get(key: string): Promise<Row<T> | null> {
    for (const epoch of this.ns.epochs()) {
      const cTok = await this.ns.encryptName(this.collection, epoch);
      const kTok = await this.ns.encryptName(key, epoch);
      try {
        const raw = await this.ns.transport.json<RawRow>(
          "GET",
          this.url(cTok, kTok),
        );
        const row = await this.decode(raw);
        return "deleted" in row ? null : row;
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
    }
    return null;
  }

  /** Every row (live, or with tombstones), across key epochs; newest epoch wins. */
  async list(
    opts: { includeDeleted?: boolean } = {},
  ): Promise<(Row<T> | { key: string; rev: string; deleted: true })[]> {
    const out = new Map<
      string,
      Row<T> | { key: string; rev: string; deleted: true }
    >();
    for (const epoch of [...this.ns.epochs()].reverse()) {
      const cTok = await this.ns.encryptName(this.collection, epoch);
      let cursor: string | undefined;
      do {
        const page = await this.ns.transport.json<{
          records: RawRow[];
          cursor?: string;
          seq: string;
        }>("GET", this.url(cTok), {
          query: {
            cursor,
            limit: 1000,
            includeDeleted: opts.includeDeleted ? 1 : undefined,
          },
        });
        this.ns.observe(page.seq);
        for (const r of page.records) {
          const row = await this.decode(r);
          out.set(row.key, row);
        }
        cursor = page.cursor;
      } while (cursor);
    }
    return [...out.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  }

  async put(
    key: string,
    value: T,
    cond: { ifRev?: string; ifAbsent?: boolean } = {},
  ): Promise<string> {
    return this.ns.withEpochRetry(async () => {
      const cTok = await this.ns.encryptName(this.collection);
      const kTok = await this.ns.encryptName(key);
      const sealed = b64u(
        await this.ns.seal(
          utf8(JSON.stringify(value)),
          aad.record(this.ns.id, cTok, kTok),
        ),
      );
      try {
        const out = await this.ns.transport.json<{ rev: string; seq: string }>(
          "PUT",
          this.url(cTok, kTok),
          {
            json: { value: sealed },
            headers: {
              ...(cond.ifRev ? { "If-Match": `"${cond.ifRev}"` } : {}),
              ...(cond.ifAbsent ? { "If-None-Match": "*" } : {}),
            },
          },
        );
        this.ns.observe(out.seq);
        return out.rev;
      } catch (err) {
        if (err instanceof PreconditionError)
          throw new RowConflictError<T>(
            key,
            await this.decodeCurrent(err.current),
          );
        throw err;
      }
    });
  }

  async delete(
    key: string,
    cond: { ifRev?: string } = {},
  ): Promise<string | null> {
    const cTok = await this.ns.encryptName(this.collection);
    const kTok = await this.ns.encryptName(key);
    try {
      const out = await this.ns.transport.json<{ rev: string; seq: string }>(
        "DELETE",
        this.url(cTok, kTok),
        {
          headers: cond.ifRev ? { "If-Match": `"${cond.ifRev}"` } : {},
        },
      );
      this.ns.observe(out.seq);
      return out.rev;
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      if (err instanceof PreconditionError)
        throw new RowConflictError<T>(
          key,
          await this.decodeCurrent(err.current),
        );
      throw err;
    }
  }

  async decodeCurrent(
    current: unknown,
  ): Promise<RowConflictError<T>["current"]> {
    if (!current || typeof current !== "object") return null;
    const c = current as RawRow;
    try {
      const row = await this.decode(c);
      return "deleted" in row
        ? { key: row.key, rev: row.rev, deleted: true }
        : row;
    } catch {
      return null;
    }
  }
}
