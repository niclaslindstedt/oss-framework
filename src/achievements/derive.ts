import type { Achievement } from "./types.ts";

// Pure: returns the ids of derived-trigger achievements whose predicate flipped
// from false to true on this (prev → next) transition AND that aren't already
// in `alreadyUnlocked`. Manual triggers are skipped — they fire through the
// bus, not the state watcher.
//
// Predicates that declare a `slices` extractor are skipped when every listed
// slice is referentially unchanged — relying on your state keeping identity on
// the islands it didn't touch, so a change to one slice can't flip a predicate
// that only reads another. A cheap pre-check that avoids the full walks several
// predicates do.
export function deriveUnlocks<TState>(
  catalog: readonly Achievement<TState>[],
  prev: TState,
  next: TState,
  alreadyUnlocked: Record<string, number>,
): string[] {
  const fresh: string[] = [];
  for (const ach of catalog) {
    if (ach.trigger.kind !== "derived") continue;
    if (alreadyUnlocked[ach.id] !== undefined) continue;
    const trigger = ach.trigger;
    if (trigger.slices) {
      const prevSlices = trigger.slices(prev);
      const nextSlices = trigger.slices(next);
      let changed = false;
      for (let i = 0; i < prevSlices.length; i += 1) {
        if (prevSlices[i] !== nextSlices[i]) {
          changed = true;
          break;
        }
      }
      if (!changed) continue;
    }
    if (trigger.predicate(prev, next)) fresh.push(ach.id);
  }
  return fresh;
}
