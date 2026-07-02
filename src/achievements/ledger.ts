// The unlock-ledger transitions the watcher's `record` contract requires. The
// watcher (`useAchievementWatcher`) calls your `record(ids)` and expects it to
// be idempotent per id and to return only the genuinely-new ids; most stores
// also keep an unseen queue (earned-but-unacknowledged, driving the badge +
// unlock modal). Those mechanics are generic — every adopter re-derives the
// same subtle transition — so the framework owns them here as pure functions.
// Your app still owns *where* the ledger lives (a localStorage key, a synced
// settings doc, a server) and any app-specific fields hung off it.

/**
 * The generic unlock-ledger slice: which achievement ids are earned
 * (`id → unlock timestamp`) and which are earned-but-unacknowledged (the
 * unseen queue). Your store holds these; the framework owns the transitions on
 * them. Extra app fields (e.g. a first-run backfill flag) live alongside and
 * pass through untouched.
 */
export type UnlockLedger = {
  /** Earned ids mapped to their unlock timestamp. */
  unlocked: Record<string, number>;
  /** Earned but not yet acknowledged — drives a badge / unlock modal. */
  unseen: string[];
};

/**
 * Record freshly-earned ids into the ledger, idempotently. Already-earned ids
 * are ignored; each genuinely-new id gets `now` as its timestamp and joins the
 * unseen queue (deduped). Returns the `next` ledger (referentially unchanged
 * when nothing was new) and the `fresh` ids that were genuinely new — what the
 * caller celebrates. This is the exact transition the watcher's `record`
 * contract needs; a naive rewrite double-fires the celebration.
 *
 * Generic over your ledger shape (`T extends UnlockLedger`) so extra fields
 * survive the update. `now` is injected (not read from `Date.now()`) so the
 * function stays pure and testable.
 */
export function applyUnlocks<T extends UnlockLedger>(
  prev: T,
  ids: readonly string[],
  now: number,
): { next: T; fresh: string[] } {
  const fresh = ids.filter((id) => prev.unlocked[id] === undefined);
  if (fresh.length === 0) return { next: prev, fresh };
  const unlocked = { ...prev.unlocked };
  const unseen = [...prev.unseen];
  for (const id of fresh) {
    unlocked[id] = now;
    if (!unseen.includes(id)) unseen.push(id);
  }
  return { next: { ...prev, unlocked, unseen }, fresh };
}

/**
 * Empty the unseen queue (identity-preserving when already empty). Call after
 * the user acknowledges the newly-unlocked ids (e.g. on unlock-modal close).
 * Leaves `unlocked` and any extra fields untouched.
 */
export function clearUnseen<T extends UnlockLedger>(prev: T): T {
  return prev.unseen.length === 0 ? prev : { ...prev, unseen: [] };
}
