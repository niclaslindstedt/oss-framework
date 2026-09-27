// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Three-way merge of JSON values — the engine behind row-level conflict
// resolution. Given what both sides started from (`base`), a change on one
// side only is simply taken; plain objects merge field by field, recursively;
// only a field both sides changed differently is a real conflict, handed to
// `resolve`. Pure: no clock, no I/O.

export type ConflictContext = {
  /** Field path from the root of the merged value. */
  path: string[];
  base: unknown;
  local: unknown;
  remote: unknown;
  /** The whole local / remote values being merged (e.g. for their timestamps). */
  localRoot: unknown;
  remoteRoot: unknown;
};

export type MergeOptions = {
  /** Decide a true conflict. Default: keep the local value. */
  resolve?: (ctx: ConflictContext) => unknown;
  /** Arrays as whole values (default) or as sets merged by element. */
  arrays?: "value" | "union";
  /** A field deleted on one side and edited on the other stays deleted. */
  deleteWins?: boolean;
};

const ABSENT = undefined;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => jsonEqual(x, bb[i]));
  }
  const ka = Object.keys(a as object).filter(
    (k) => (a as Record<string, unknown>)[k] !== undefined,
  );
  const kb = Object.keys(b as object).filter(
    (k) => (b as Record<string, unknown>)[k] !== undefined,
  );
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    jsonEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

function unionArrays(
  base: unknown[] | undefined,
  local: unknown[],
  remote: unknown[],
): unknown[] {
  const has = (list: unknown[] | undefined, x: unknown) =>
    (list ?? []).some((y) => jsonEqual(x, y));
  const removedRemotely = (x: unknown) => has(base, x) && !has(remote, x);
  const out = local.filter((x) => !removedRemotely(x));
  for (const x of remote) {
    const removedLocally = has(base, x) && !has(local, x);
    if (!removedLocally && !has(out, x)) out.push(x);
  }
  return out;
}

export function threeWayMerge(
  base: unknown,
  local: unknown,
  remote: unknown,
  options: MergeOptions = {},
): unknown {
  return merge(base, local, remote, [], options, local, remote);
}

function merge(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string[],
  o: MergeOptions,
  localRoot: unknown,
  remoteRoot: unknown,
): unknown {
  if (jsonEqual(local, remote)) return local;
  if (base !== ABSENT && jsonEqual(base, local)) return remote;
  if (base !== ABSENT && jsonEqual(base, remote)) return local;

  // Edit vs delete.
  if (local === ABSENT || remote === ABSENT) {
    if (base === ABSENT) return local ?? remote; // added on one side only
    return o.deleteWins ? ABSENT : (local ?? remote);
  }

  if (
    isPlainObject(local) &&
    isPlainObject(remote) &&
    (base === ABSENT || isPlainObject(base))
  ) {
    const b = (base ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of new Set([
      ...Object.keys(local),
      ...Object.keys(remote),
      ...Object.keys(b),
    ])) {
      const v = merge(
        b[key],
        local[key],
        remote[key],
        [...path, key],
        o,
        localRoot,
        remoteRoot,
      );
      if (v !== ABSENT) out[key] = v;
    }
    return out;
  }

  if (
    o.arrays === "union" &&
    Array.isArray(local) &&
    Array.isArray(remote) &&
    (base === ABSENT || Array.isArray(base))
  ) {
    return unionArrays(base as unknown[] | undefined, local, remote);
  }

  const resolve = o.resolve ?? ((c: ConflictContext) => c.local);
  return resolve({ path, base, local, remote, localRoot, remoteRoot });
}

function stamp(root: unknown, field: string): number | null {
  if (!isPlainObject(root)) return null;
  const v = root[field];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * A resolver for records that carry a modification time: the side whose
 * `field` (epoch ms or an ISO string) is newer wins a conflicting field;
 * ties go to remote so every device converges on the same value.
 */
export function newerByField(
  field = "updatedAt",
): (ctx: ConflictContext) => unknown {
  return (ctx) => {
    const l = stamp(ctx.localRoot, field);
    const r = stamp(ctx.remoteRoot, field);
    if (l !== null && r !== null) return l > r ? ctx.local : ctx.remote;
    if (l !== null) return ctx.local;
    return ctx.remote;
  };
}
