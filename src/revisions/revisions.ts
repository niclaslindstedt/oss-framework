// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The edit history of a record, as the list of snapshots it has been.
//
// A revision is the *whole* record at a moment rather than a diff: reading
// what a record said on a date is then a lookup rather than a replay, and a
// device that missed a revision in the middle still reads every other one
// correctly. The cost is bytes, and the records this is for — a contact, a
// customer, a set of settings — are a few hundred of them.
//
// Nothing here knows what the record is. The caller says when (`at`, an ISO
// timestamp or anything that sorts as one), and the module owns the four
// rules every history needs: a save that changed nothing is not a revision;
// the list stays in stamp order whatever order the saves arrive in; two
// devices' histories merge as a union; and "what did it say then" is the
// latest snapshot at or before then.
//
// Pure and total: no clock, no ids, no storage.

/** One snapshot of a record. */
export type Revision<T> = {
  /** When the save that produced this snapshot happened. Compared as a
   *  string, so an ISO 8601 timestamp is the shape to use. */
  at: string;
  data: T;
};

/**
 * Structural equality over JSON-shaped values — objects, arrays and
 * primitives. Key order does not count; `undefined`-valued keys do. This is
 * the test for "did this save change anything", so it is exported for a
 * caller that wants to ask the same question before saving at all.
 */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) =>
    sameRecord(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

function byStamp<T>(a: Revision<T>, b: Revision<T>): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

/**
 * Append a snapshot, unless it says nothing the latest one does not.
 *
 * The list stays sorted by `at`: a snapshot stamped earlier than the latest
 * (a clock set back, a save that arrived late) is filed where its stamp puts
 * it rather than at the end. The input is never mutated.
 */
export function recordRevision<T>(
  history: readonly Revision<T>[],
  data: T,
  at: string,
): Revision<T>[] {
  const latest = history[history.length - 1];
  if (latest && sameRecord(latest.data, data)) return [...history];
  return [...history, { at, data }].sort(byStamp);
}

/**
 * The snapshot in force at a moment: the latest one stamped at or before it,
 * or null when the record did not exist yet.
 */
export function revisionAt<T>(
  history: readonly Revision<T>[],
  at: string,
): Revision<T> | null {
  let found: Revision<T> | null = null;
  for (const rev of history) {
    if (rev.at <= at) found = rev;
    else break;
  }
  return found;
}

/**
 * Two histories of the same record, as one: the union by stamp, in order,
 * so two devices that each saved the record keep both saves. Where both
 * carry a revision with the same stamp, the first history's is kept.
 */
export function mergeRevisions<T>(
  a: readonly Revision<T>[],
  b: readonly Revision<T>[],
): Revision<T>[] {
  const byAt = new Map<string, Revision<T>>();
  for (const rev of a) byAt.set(rev.at, rev);
  for (const rev of b) if (!byAt.has(rev.at)) byAt.set(rev.at, rev);
  return [...byAt.values()].sort(byStamp);
}

/**
 * The dotted paths whose values differ between two snapshots — what a
 * history screen highlights as "changed: address.city, phone". Nested
 * objects are walked; arrays are compared whole, and a value present on one
 * side only is reported at its own path. Two equal values report nothing;
 * two primitives that differ report `"."`.
 */
export function changedPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (sameRecord(a, b)) return [];
  const objects =
    typeof a === "object" &&
    typeof b === "object" &&
    a &&
    b &&
    !Array.isArray(a) &&
    !Array.isArray(b);
  if (!objects) return [prefix || "."];
  const keys = new Set([
    ...Object.keys(a as object),
    ...Object.keys(b as object),
  ]);
  const out: string[] = [];
  for (const key of [...keys].sort()) {
    out.push(
      ...changedPaths(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }
  return out;
}
