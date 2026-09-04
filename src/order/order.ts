// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What you do to a **stored arrangement**: move one id in it, and lay a list
// of things out the way it says.
//
// Any app that lets someone rearrange a list — a toolbar's buttons, a
// dashboard's panels, a settings screen's sections, a sidebar's destinations —
// ends up persisting that arrangement, and the only sane thing to persist is a
// list of ids. The entries themselves are the build's: they have components in
// them, callbacks, translated labels. So the stored value is a *permutation*,
// and it is a permutation of a list that the build which wrote it had and this
// build may not.
//
// That is the whole difficulty, and it is why the two functions below are not
// a `sort` with a comparator. A stored order is read by builds that ship a
// different set of entries than the one it was written against: a release adds
// a tool, removes an effect, renames a section; a user downgrades. Every such
// list therefore has the same two problems — an id this build no longer knows,
// and an entry the stored order was written before — and solving them once
// here is the difference between one rule and three copies of it that drift.
//
// Pure and DOM-free: the rules can be read and tested without a pointer.

/** Move one id from `from` to `to` — what an up / down arrow sends, and what a
 *  dropped drag resolves to.
 *
 *  The whole current order goes in rather than a delta, because that is the
 *  only thing a stored order can be: a permutation of ids means nothing
 *  without the list of entries it is a permutation of (see {@link applyOrder}).
 *  An out-of-range index is a no-op rather than an error — a stale settings
 *  blob is the usual source, and dropping the move is what leaves the list
 *  intact. */
export function moveInOrder(
  order: readonly string[],
  from: number,
  to: number,
): string[] {
  if (from === to || from < 0 || to < 0) return [...order];
  if (from >= order.length || to >= order.length) return [...order];
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * Lay `items` out the way `order` says — and leave everything it doesn't
 * mention exactly where it already was.
 *
 * That second half is the point. If the unnamed entries were appended, every
 * entry added since the order was stored would pile up at the end of a list
 * its author had a place for — a new tool exiled to the far right of a toolbar
 * because somebody once dragged two other tools around. Instead the named ids
 * are dealt back into the slots they already occupy, and an entry the order
 * has never heard of keeps the position it was registered in.
 *
 * Ids this build doesn't have, and ids named twice, are dropped: a stale
 * stored value is the usual source of both, and either would otherwise leave
 * a hole. An empty or wholly unrecognised order hands back the registered
 * order unchanged.
 */
export function applyOrder<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[],
): T[] {
  const seen = new Set<string>();
  const named: T[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const item = items.find((candidate) => candidate.id === id);
    if (!item) continue;
    seen.add(id);
    named.push(item);
  }
  if (named.length === 0) return [...items];
  let next = 0;
  return items.map((item) => (seen.has(item.id) ? named[next++]! : item));
}

/** The order `items` are currently in, as the list of ids that would reproduce
 *  it — what a caller stores after a move.
 *
 *  Storing the *whole* list rather than only the entries that were dragged is
 *  deliberate: it is what makes {@link applyOrder} idempotent, and what keeps a
 *  later reorder from having to know which entries were already spoken for. */
export function orderOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}
