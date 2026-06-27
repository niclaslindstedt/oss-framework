// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { deriveUnlocks } from "@niclaslindstedt/oss-framework/achievements";

import { CATALOG, EMPTY_STATE, type AchState } from "./achievements.ts";

// The app's achievements store — the seam the framework leaves to the app:
// where earned trophies live. The framework's watcher calls `record` and reads
// `unlocked`; this hook owns persistence (localStorage) and the unseen queue
// that lights the trophy button. A real app would sync this map across devices.

type Persisted = {
  // id → unlock timestamp.
  unlocked: Record<string, number>;
  // Earned but not yet acknowledged — drives the button badge + unlock modal.
  unseen: string[];
  // Whether the first-run retroactive backfill has happened (see below).
  seeded: boolean;
};

const STORAGE_KEY = "oss-demo:checklist:achievements";

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        unlocked: p.unlocked ?? {},
        unseen: p.unseen ?? [],
        seeded: p.seeded ?? false,
      };
    }
  } catch {
    // ignore
  }
  return { unlocked: {}, unseen: [], seeded: false };
}

export type AchievementsStore = ReturnType<typeof useAchievements>;

export function useAchievements(state: AchState, enabled: boolean) {
  const [p, setP] = useState<Persisted>(load);
  const ref = useRef(p);
  ref.current = p;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // ignore
    }
  }, [p]);

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

  // The watcher's writer: idempotent per id, returns only the genuinely-new ids
  // (what the caller celebrates) and pushes them onto the unseen queue.
  const record = useCallback((ids: readonly string[]): string[] => {
    const current = ref.current.unlocked;
    const fresh = ids.filter((id) => current[id] === undefined);
    if (fresh.length === 0) return [];
    setP((prev) => {
      const unlocked = { ...prev.unlocked };
      const unseen = [...prev.unseen];
      const ts = Date.now();
      for (const id of ids) {
        if (unlocked[id] !== undefined) continue;
        unlocked[id] = ts;
        if (!unseen.includes(id)) unseen.push(id);
      }
      return { ...prev, unlocked, unseen };
    });
    return fresh;
  }, []);

  const clearUnseen = useCallback(() => {
    setP((prev) => (prev.unseen.length === 0 ? prev : { ...prev, unseen: [] }));
  }, []);

  return {
    unlocked: p.unlocked,
    unseen: p.unseen,
    record,
    clearUnseen,
  };
}
