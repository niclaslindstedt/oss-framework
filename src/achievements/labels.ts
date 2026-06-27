import type { ReactNode } from "react";

import {
  CompassGlyph,
  SproutGlyph,
  WandGlyph,
  WorkflowGlyph,
} from "./glyphs.tsx";
import type { AchievementTier, Glyph } from "./types.ts";

// All visible chrome strings the modals and button render. Every field has an
// English default (`DEFAULT_*` below); pass a partial override to translate or
// re-word. The per-achievement copy (name / condition / learnMore) is NOT here
// — it lives on the catalog entries.

export type AchievementsModalLabels = {
  title: string;
  intro: ReactNode;
  locked: string;
  learnMore: string;
  close: string;
  counter: (s: {
    unlocked: number;
    total: number;
    earned: number;
    max: number;
  }) => ReactNode;
  tierPoints: (s: { earned: number; max: number }) => ReactNode;
  tier: Record<AchievementTier, { title: string; subtitle: string }>;
};

export type AchievementUnlockLabels = {
  titleOne: ReactNode;
  titleOther: (n: number) => ReactNode;
  dismiss: string;
  close: string;
};

export type TrophyButtonLabels = {
  /** The quiet (nothing-new) label, also the visible/aria text. */
  open: string;
  /** The lit aria label, given the unseen count. */
  unseen: (n: number) => string;
};

export const DEFAULT_ACHIEVEMENTS_MODAL_LABELS: AchievementsModalLabels = {
  title: "Achievements",
  intro:
    "Every feature is an achievement. Do the thing once and it unlocks. Four tiers, from just opening the app to bending it to your workflow — pick whichever is next for you.",
  locked: "Locked",
  learnMore: "Learn more",
  close: "Close",
  counter: ({ unlocked, total, earned, max }) =>
    `${unlocked} of ${total} unlocked · ${earned} / ${max} pts`,
  tierPoints: ({ earned, max }) => `· ${earned} / ${max} pts`,
  tier: {
    beginner: {
      title: "Beginner",
      subtitle: "You just opened the app. What do you do?",
    },
    intermediate: {
      title: "Intermediate",
      subtitle: "You want to do more than the basics.",
    },
    pro: {
      title: "Pro",
      subtitle: "Make it yours and take it everywhere.",
    },
    expert: {
      title: "Expert",
      subtitle: "Bend the app to your exact workflow.",
    },
  },
};

export const DEFAULT_ACHIEVEMENT_UNLOCK_LABELS: AchievementUnlockLabels = {
  titleOne: "Achievement unlocked!",
  titleOther: (n) => `${n} achievements unlocked!`,
  dismiss: "Awesome!",
  close: "Close",
};

export const DEFAULT_TROPHY_BUTTON_LABELS: TrophyButtonLabels = {
  open: "Achievements",
  unseen: (n) => (n === 1 ? "1 new achievement" : `${n} new achievements`),
};

// The badge glyph for each tier header. Override via the modal's `tierGlyphs`
// prop to match your app's iconography.
export const DEFAULT_TIER_GLYPHS: Record<AchievementTier, Glyph> = {
  beginner: SproutGlyph,
  intermediate: CompassGlyph,
  pro: WorkflowGlyph,
  expert: WandGlyph,
};
