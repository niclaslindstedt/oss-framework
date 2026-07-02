// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef } from "react";

import {
  applyUnlocks,
  clearUnseen as clearUnseenQueue,
  deriveUnlocks,
} from "@niclaslindstedt/oss-framework/achievements";
import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import { CATALOG, EMPTY_STATE, type AchState } from "./achievements.ts";

// The app's achievements store — the seam the framework leaves to the app:
// where earned trophies live. The framework's watcher calls `record` and reads
// `unlocked`; this hook owns the unseen queue that lights the trophy button
// and *where* the map lives (a localStorage key, via the framework's
// `useLocalStorageState` — which owns the safe-parse / merge / write-through
// mechanics). A real app would sync this map across devices.

type Persisted = {
  // id → unlock timestamp.
  unlocked: Record<string, number>;
  // Earned but not yet acknowledged — drives the button badge + unlock modal.
  unseen: string[];
  // Whether the first-run retroactive backfill has happened (see below).
  seeded: boolean;
};

const STORAGE_KEY = "oss-demo:checklist:achievements";

const EMPTY: Persisted = { unlocked: {}, unseen: [], seeded: false };

export type AchievementsStore = ReturnType<typeof useAchievements>;

export function useAchievements(state: AchState, enabled: boolean) {
  const [p, setP] = useLocalStorageState<Persisted>(STORAGE_KEY, EMPTY);
  const ref = useRef(p);
  ref.current = p;

  // First-run retroactive backfill. The watcher is forward-going only — it never
  // backfills unlocks the saved document already satisfies. For a demo that
  // boots with a rich seed that's the wrong default (everything would read as
  // locked), so on the very first enabled run we award what the document already
  // earns, using the framework's pure `deriveUnlocks` against an empty baseline.
  // Recorded as *seen* (no unseen badge) — you discover these in the tour, then
  // earn the rest live (Clean Sweep, Time Traveler) and get the badge + modal.
  useEffect(() => {
    if (!enabled || ref.current.seeded) return;
    const initial = deriveUnlocks(CATALOG, EMPTY_STATE, state, {});
    setP((prev) => {
      if (prev.seeded) return prev;
      const unlocked = { ...prev.unlocked };
      const ts = Date.now();
      for (const id of initial) {
        if (unlocked[id] === undefined) unlocked[id] = ts;
      }
      return { ...prev, unlocked, seeded: true };
    });
    // Run once the document is present and the feature is enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // The watcher's writer. The idempotent-record / fresh-ids / unseen-queue
  // mechanics are the framework's `applyUnlocks`; the app only owns *where* the
  // ledger lives and the synchronous fresh-ids return the watcher contract
  // needs (React setState is fire-and-forget, so derive fresh from the ref).
  const record = useCallback((ids: readonly string[]): string[] => {
    const { fresh } = applyUnlocks(ref.current, ids, Date.now());
    if (fresh.length === 0) return fresh;
    setP((prev) => applyUnlocks(prev, ids, Date.now()).next);
    return fresh;
  }, []);

  const clearUnseen = useCallback(() => {
    setP((prev) => clearUnseenQueue(prev));
  }, []);

  return {
    unlocked: p.unlocked,
    unseen: p.unseen,
    record,
    clearUnseen,
  };
}
