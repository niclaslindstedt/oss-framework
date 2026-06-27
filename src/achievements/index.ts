// Public surface for the achievements module: the generic engine (derive +
// watcher), the manual-unlock bus, the tier constants/types, and the UI
// (the tour modal, the unlock-celebration modal, the trophy button). Your app
// owns the catalog and the store; the framework owns everything here.

export { deriveUnlocks } from "./derive.ts";
export { unlock, subscribe, drain, resetBus } from "./bus.ts";
export {
  useAchievementWatcher,
  type AchievementWatcherParams,
} from "./useAchievementWatcher.ts";
export { TIER_POINTS, TIER_ORDER } from "./types.ts";
export type {
  Achievement,
  AchievementDisplay,
  AchievementTier,
  // The glyphs module also exports a `Glyph` (its catalogue renderer), so the
  // catalog-entry glyph type is published under a distinct name to keep the
  // root barrel unambiguous.
  Glyph as AchievementGlyph,
  Trigger,
} from "./types.ts";

export { AchievementsModal } from "./AchievementsModal.tsx";
export { AchievementUnlockModal } from "./AchievementUnlockModal.tsx";
export { TrophyButton } from "./TrophyButton.tsx";

export {
  TrophyGlyph,
  SproutGlyph,
  CompassGlyph,
  WorkflowGlyph,
  WandGlyph,
} from "./glyphs.tsx";

export {
  DEFAULT_ACHIEVEMENTS_MODAL_LABELS,
  DEFAULT_ACHIEVEMENT_UNLOCK_LABELS,
  DEFAULT_TROPHY_BUTTON_LABELS,
  DEFAULT_TIER_GLYPHS,
  type AchievementsModalLabels,
  type AchievementUnlockLabels,
  type TrophyButtonLabels,
} from "./labels.ts";
