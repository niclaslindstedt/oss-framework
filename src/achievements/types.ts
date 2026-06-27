import type { ReactNode } from "react";

// The achievement model — the framework's reusable gamification core. The
// engine (derive + watcher), the bus, and the modals are generic over a single
// app-defined `TState`: the slice(s) of your app's state a derived predicate
// reads. Your app owns the *catalog* (which features are trophies and how each
// unlocks) and the *store* (where earned ids live); the framework owns the
// type those entries satisfy and the machinery that runs them.

// A glyph is any component taking an optional `className`, so the caller drives
// size and colour through utility classes (strokes paint with `currentColor`).
// Matches the framework's own icon components, so anything from
// `@niclaslindstedt/oss-framework/components` or `/glyphs` works as a glyph.
export type Glyph = (props: { className?: string }) => ReactNode;

// Four tiers that mirror the four stages of growing into an app — from "just
// opened it" to "bending it to my workflow". Point values are uniform per tier
// so a catalog stays easy to balance as it grows.
export type AchievementTier = "beginner" | "intermediate" | "pro" | "expert";

export const TIER_POINTS: Record<AchievementTier, number> = {
  beginner: 10,
  intermediate: 25,
  pro: 50,
  expert: 100,
};

export const TIER_ORDER: readonly AchievementTier[] = [
  "beginner",
  "intermediate",
  "pro",
  "expert",
];

// Two kinds of unlock trigger:
//
// - `derived` — the watcher receives every (prev, next) `TState` transition and
//   runs each `predicate`. When the predicate flips from false to true on this
//   transition, the unlock fires. The predicate sees the full pre- and
//   post-transition state, so it can spot "the user just created their first
//   item", "the user just turned a setting on", etc.
//
// - `manual` — the trigger lives outside the watched state (cloud connect,
//   clipboard copy, install, a language switch). Fire it by calling `unlock(id)`
//   from the chokepoint that observes the action; the bus holds it until the
//   mounted watcher records it.
export type Trigger<TState> =
  | {
      kind: "derived";
      predicate: (prev: TState, next: TState) => boolean;
      // Optional slice extractor. When provided, `deriveUnlocks` invokes the
      // predicate only when at least one returned reference differs between
      // prev and next — so a change to a slice this predicate never reads skips
      // it without running it. Each slice listed must be one the predicate
      // actually reads, or a relevant change would be silently filtered out.
      // Relies on your state keeping referential identity on untouched slices.
      slices?: (state: TState) => readonly unknown[];
    }
  | { kind: "manual" };

// The display half of an achievement — everything the modals render. Carry the
// copy inline (a green-field app can hard-code it; an i18n app fills it from its
// translator when it builds the catalog), so there is no parallel string table
// to keep in sync.
export type AchievementDisplay = {
  // Stable string id — once shipped, never renamed. Used as the key in the
  // earned-ids map, the bus queue, and as the React key in catalog renders.
  id: string;
  tier: AchievementTier;
  glyph: Glyph;
  name: ReactNode;
  // One line describing what unlocks it, shown under the name.
  condition: ReactNode;
  // Optional expanded body, revealed in a per-achievement `<details>`. Omit it
  // when the condition says enough.
  learnMore?: ReactNode;
};

// A full catalog entry: the display fields plus how it unlocks.
export type Achievement<TState> = AchievementDisplay & {
  trigger: Trigger<TState>;
};
