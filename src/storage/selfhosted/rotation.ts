// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Namespace key rotation (SPEC §4.3): a fresh key under a new epoch, wrapped
// only to the current members; the server then refuses writes sealed under
// older epochs, and this device re-encrypts what is already stored — files,
// rows and the namespace metadata — so a removed member's old key opens
// nothing written or rewritten after this point.

import { aad, b64u, nameEpoch, randomBytes, utf8 } from "./crypto.ts";
import { FileConflictError } from "./files.ts";
import { ForbiddenError, KeysMissingError } from "./errors.ts";
import type { Namespace, PlainOp, RawNamespace } from "./namespace.ts";
import { RecordsApi } from "./records-api.ts";

const CHUNK = 200;

export async function rotateNamespaceKey(ns: Namespace): Promise<{ epoch: number; files: number; rows: number }> {
  await ns.refresh();
  if (ns.role !== "owner") throw new ForbiddenError("only owners can rotate keys");
  const members = await ns.members();
  const next = ns.epoch + 1;
  const nk = randomBytes(32);
  const wraps: Record<string, string> = {};
  for (const m of members) {
    if (!m.aekPublic) throw new KeysMissingError(`${m.name} has not set up an account key yet`);
    wraps[m.accountId] = await ns.ctx.client.wrapForAccount(ns.id, next, m.accountId, m.aekPublic, nk);
  }
  await ns.ctx.client.adoptNamespaceKey(ns.id, next, nk);
  const raw = await ns.transport.json<RawNamespace>("POST", `/v1/namespaces/${ns.id}/rotate`, { json: { epoch: next, wraps } });
  ns.observe(raw.seq);
  ns.info = { ...ns.info, epoch: raw.epoch, keys: raw.keys };

  // Metadata under the new key.
  const sealedMeta = b64u(await ns.seal(utf8(JSON.stringify(ns.meta)), aad.nsmeta(ns.id)));
  await ns.transport.json("PATCH", `/v1/namespaces/${ns.id}`, { json: { meta: sealedMeta } });

  // Files: rewrite each old-epoch file under its new-epoch name.
  let files = 0;
  for (const f of await ns.files.list()) {
    if (nameEpoch(f.token.split("/")[0]!) >= next) continue;
    const read = await ns.files.read(f.path);
    if (!read) continue;
    try {
      await ns.files.write(f.path, read.bytes, { ifAbsent: true, mime: f.mime, tags: f.tags, mtime: f.mtime });
    } catch (err) {
      // A device already wrote this path under the new key: that copy is newer.
      if (!(err instanceof FileConflictError)) throw err;
    }
    await deleteToken(ns, f.token, f.rev);
    files++;
  }

  // Rows: re-put each old-epoch row under new-epoch names, then drop the old one.
  let rows = 0;
  for (const c of await ns.collections()) {
    if (c.epoch >= next) continue;
    const api = new RecordsApi<unknown>(ns, c.collection);
    const live = (await api.list()).filter((r): r is { key: string; value: unknown; rev: string; updatedAt: number; epoch: number } => !("deleted" in r) && r.epoch < next);
    for (let i = 0; i < live.length; i += CHUNK) {
      const chunk = live.slice(i, i + CHUNK);
      const puts: PlainOp[] = chunk.map((r) => ({ op: "put", collection: c.collection, key: r.key, value: r.value, ifAbsent: true }));
      const res = await ns.batch(puts, { atomic: false });
      for (const [j, r] of chunk.entries()) {
        if (res.results[j]?.ok || res.results[j]?.error === "conflict") {
          // Already present under the new key (a device wrote meanwhile) or moved now.
          await deleteRowToken(ns, c.token, r.key, r.rev, r.epoch);
          rows++;
        }
      }
    }
  }
  return { epoch: next, files, rows };
}

async function deleteToken(ns: Namespace, token: string, rev: string): Promise<void> {
  await ns.transport.request("DELETE", `${ns.base}/files/${token}`, { headers: { "If-Match": `"${rev}"` } }).catch(() => {});
}

async function deleteRowToken(ns: Namespace, cTok: string, key: string, rev: string, epoch: number): Promise<void> {
  const kTok = await ns.encryptName(key, epoch);
  await ns.transport.request("DELETE", `${ns.base}/records/${cTok}/${kTok}`, { headers: { "If-Match": `"${rev}"` } }).catch(() => {});
}
