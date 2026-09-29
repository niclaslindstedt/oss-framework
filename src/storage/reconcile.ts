// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Files beside a document, kept in step between two stores.
//
// A document that names files — a photo per contact, a recording per note —
// syncs as text through a `StorageAdapter`, and the files have to follow it:
// the ones this device has and the other side lacks go up, the ones the
// other side has and this device lacks come down, and the ones the document
// no longer names are removed from the far side. That is the whole of it,
// and it is pure arithmetic over three sets of paths (`planReconcile`) plus
// the transfers (`reconcileFiles`), run a few at a time and never throwing
// for one file's sake: a failure is reported and the rest carry on.
//
// The document decides what is wanted. Pruning follows the document rather
// than either store, so a file is removed only once the record naming it is
// gone from the document both sides hold — and a store scoped to this
// document's own folder (`scopedByteStore`) is what keeps the prune from
// reaching a neighbour's files.

import type { ByteFileStore } from "./file-store.ts";
import type { Logger } from "./logger.ts";
import { noopLogger } from "./logger.ts";
import { DEFAULT_TRANSFER_CONCURRENCY, mapLimit } from "./transfer-retry.ts";

export type ReconcilePlan = {
  /** Wanted, here, not there. */
  push: string[];
  /** Wanted, there, not here. */
  pull: string[];
  /** There, not wanted. */
  prune: string[];
};

/** The transfers two listings and a wanted set imply. */
export function planReconcile(input: {
  local: Iterable<string>;
  remote: Iterable<string>;
  wanted: Iterable<string>;
}): ReconcilePlan {
  const local = new Set(input.local);
  const remote = new Set(input.remote);
  const wanted = new Set(input.wanted);
  const push: string[] = [];
  const pull: string[] = [];
  const prune: string[] = [];
  for (const path of wanted) {
    if (local.has(path) && !remote.has(path)) push.push(path);
    else if (!local.has(path) && remote.has(path)) pull.push(path);
  }
  for (const path of remote) if (!wanted.has(path)) prune.push(path);
  push.sort();
  pull.sort();
  prune.sort();
  return { push, pull, prune };
}

export type ReconcileFailure = {
  path: string;
  op: "push" | "pull" | "prune";
  error: unknown;
};

export type ReconcileResult = {
  pushed: string[];
  pulled: string[];
  pruned: string[];
  failed: ReconcileFailure[];
};

export type ReconcileOptions = {
  local: ByteFileStore;
  remote: ByteFileStore;
  /** The paths the document names. */
  wanted: Iterable<string>;
  /** Whether to remove files the document no longer names from the far
   *  side. Defaults to on; off while the document itself has not been
   *  pushed yet, since the far side's document may still name them. */
  prune?: boolean;
  /** Whether to send this device's files. Off keeps the sweep read-only. */
  push?: boolean;
  concurrency?: number;
  /** A file's type, for stores that keep one. */
  mimeFor?: (path: string) => string | undefined;
  /** Called with each transfer as it finishes. */
  onProgress?: (done: number, total: number) => void;
  /** Bytes as they go up and come down, for a store that seals its files
   *  — encryption before the far side, decryption after it. */
  transform?: {
    up: (bytes: Uint8Array, path: string) => Promise<Uint8Array>;
    down: (bytes: Uint8Array, path: string) => Promise<Uint8Array>;
  };
  logger?: Logger;
};

/** Carry the plan out. Never throws for one file: every failure is in
 *  `failed`, with the operation and the error. */
export async function reconcileFiles(
  options: ReconcileOptions,
): Promise<ReconcileResult> {
  const log = options.logger ?? noopLogger;
  const [localEntries, remoteEntries] = await Promise.all([
    options.local.list(),
    options.remote.list(),
  ]);
  const plan = planReconcile({
    local: localEntries.map((e) => e.path),
    remote: remoteEntries.map((e) => e.path),
    wanted: options.wanted,
  });
  const result: ReconcileResult = {
    pushed: [],
    pulled: [],
    pruned: [],
    failed: [],
  };
  const limit = options.concurrency ?? DEFAULT_TRANSFER_CONCURRENCY;
  const push = options.push ?? true;
  const prune = options.prune ?? true;
  const jobs: Array<{ path: string; op: ReconcileFailure["op"] }> = [
    ...(push ? plan.push.map((path) => ({ path, op: "push" as const })) : []),
    ...plan.pull.map((path) => ({ path, op: "pull" as const })),
    ...(prune
      ? plan.prune.map((path) => ({ path, op: "prune" as const }))
      : []),
  ];
  let done = 0;
  await mapLimit(jobs, limit, async ({ path, op }) => {
    try {
      if (op === "push") {
        const bytes = await options.local.readBytes(path);
        if (bytes) {
          const up = options.transform
            ? await options.transform.up(bytes, path)
            : bytes;
          await options.remote.writeBytes(path, up, options.mimeFor?.(path));
          result.pushed.push(path);
        }
      } else if (op === "pull") {
        const bytes = await options.remote.readBytes(path);
        if (bytes) {
          const down = options.transform
            ? await options.transform.down(bytes, path)
            : bytes;
          await options.local.writeBytes(path, down, options.mimeFor?.(path));
          result.pulled.push(path);
        }
      } else {
        await options.remote.remove(path);
        result.pruned.push(path);
      }
    } catch (error) {
      log.warn(`reconcile: ${op} ${path} failed`, error);
      result.failed.push({ path, op, error });
    } finally {
      done += 1;
      options.onProgress?.(done, jobs.length);
    }
  });
  result.pushed.sort();
  result.pulled.sort();
  result.pruned.sort();
  return result;
}
