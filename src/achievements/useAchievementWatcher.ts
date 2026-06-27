import { useEffect, useMemo, useRef } from "react";

import { drain, subscribe } from "./bus.ts";
import { deriveUnlocks } from "./derive.ts";
import type { Achievement } from "./types.ts";

export type AchievementWatcherParams<TState> = {
  /** Your achievement catalog — the entries whose triggers this runs. */
  catalog: readonly Achievement<TState>[];
  /**
   * The watched state. Half of the derived-predicate input. For the per-render
   * skip and the per-predicate `slices` check to do their job, keep this
   * referentially stable across renders that change nothing relevant (a fresh
   * object every render still works — it just runs every predicate each time).
   */
  state: TState;
  /** The earned-ids map (`id → unlock timestamp`). Lives in your store. */
  unlocked: Record<string, number>;
  /**
   * False until your backend's first async load has resolved. Holds both passes
   * off so loading a saved document never backfills unlocks for things the user
   * already had — only deltas produced after the watcher is live count.
   */
  loaded: boolean;
  /**
   * Set false when the user has turned achievements off. Both passes no-op while
   * disabled — no derived unlocks, and the manual bus is drained-and-discarded
   * so nothing queued mid-disable fires on re-enable. Re-enabling re-establishes
   * the baseline (like a fresh load). Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Record freshly-earned ids (idempotent per id), returning the ids that were
   * genuinely new. This is your store's writer.
   */
  record: (ids: readonly string[]) => string[];
  /** Surface the newly-unlocked ids (e.g. a toast). Optional. */
  onUnlocked?: (ids: string[]) => void;
};

// Mount once, high in your tree. Two responsibilities:
//
// 1. After every `state` transition, run `deriveUnlocks` and record each id
//    whose predicate just flipped true. The pre-`loaded` renders are absorbed
//    into the baseline so the seed → backend-load swap never fires backfills.
//
// 2. Subscribe to the manual-unlock bus and drain queued ids on each
//    notification, recording them the same way. Lets callers outside this
//    subtree record an unlock by calling `unlock(id)` — no prop drilling.
export function useAchievementWatcher<TState>({
  catalog,
  state,
  unlocked,
  loaded,
  enabled = true,
  record,
  onUnlocked,
}: AchievementWatcherParams<TState>): void {
  const ids = useMemo(() => new Set(catalog.map((a) => a.id)), [catalog]);

  const prevRef = useRef<{ state: TState } | null>(null);
  // Whether the previous derived-pass render saw `loaded === true`. The render
  // where `loaded` first flips true also carries the hydrated state, so that
  // render must only *establish* the baseline, never derive — otherwise the
  // seed → hydrated jump backfills every unlock the user already had. Reset to
  // false whenever `loaded` drops (a backend swap) so the next load re-baselines.
  const wasLoaded = useRef(false);

  // Keep the latest callbacks reachable from the bus subscription without
  // re-subscribing on every render.
  const recordRef = useRef(record);
  recordRef.current = record;
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  // Drain the manual-unlock bus. Re-runs whenever a manual `unlock()` arrives or
  // the unlock map changes. Held off until `loaded`.
  useEffect(() => {
    if (!loaded) return;
    const consume = () => {
      // Always drain first so a disabled watcher still empties the bus rather
      // than letting unlocks pile up to fire the moment it's re-enabled.
      const drained = drain().filter((id) => ids.has(id));
      if (drained.length === 0 || !enabled) return;
      const newly = recordRef.current(drained);
      if (newly.length > 0) onUnlockedRef.current?.(newly);
    };
    consume();
    return subscribe(consume);
  }, [loaded, enabled, ids, unlocked]);

  // Derived-trigger pass on every state delta.
  useEffect(() => {
    // Treat "disabled" exactly like "not loaded": keep the baseline aligned with
    // the live state and drop the loaded flag so re-enabling re-baselines and
    // never backfills the deltas produced while it was off.
    if (!loaded || !enabled) {
      prevRef.current = { state };
      wasLoaded.current = false;
      return;
    }
    const justLoaded = !wasLoaded.current;
    wasLoaded.current = true;
    const prev = prevRef.current;
    prevRef.current = { state };
    // The first render after the load (or a backend swap) only sets the baseline.
    if (justLoaded) return;
    if (prev === null) return;
    if (prev.state === state) return;
    const fresh = deriveUnlocks(catalog, prev.state, state, unlocked);
    if (fresh.length === 0) return;
    const newly = recordRef.current(fresh);
    if (newly.length > 0) onUnlockedRef.current?.(newly);
  }, [catalog, state, unlocked, loaded, enabled]);
}
