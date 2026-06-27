import { CheckIcon, CloseIcon, LockIcon } from "../components/icons.tsx";
import { Modal } from "../components/Modal.tsx";
import { TrophyGlyph } from "./glyphs.tsx";
import {
  DEFAULT_ACHIEVEMENTS_MODAL_LABELS,
  DEFAULT_TIER_GLYPHS,
  type AchievementsModalLabels,
} from "./labels.ts";
import {
  TIER_ORDER,
  TIER_POINTS,
  type AchievementDisplay,
  type AchievementTier,
  type Glyph,
} from "./types.ts";

// The achievements tour: a four-tier (Beginner → Intermediate → Pro → Expert)
// browse of the whole catalog, every feature an unlockable trophy. Reads the
// earned-ids map straight from props so it stays correct under any store.

type UnlockedMap = Record<string, number>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Your catalog (or any display-only view of it). */
  achievements: readonly AchievementDisplay[];
  /** Earned ids → unlock timestamp. */
  unlocked: UnlockedMap;
  labels?: Partial<AchievementsModalLabels>;
  tierGlyphs?: Record<AchievementTier, Glyph>;
};

export function AchievementsModal({
  open,
  onClose,
  achievements,
  unlocked,
  labels,
  tierGlyphs = DEFAULT_TIER_GLYPHS,
}: Props) {
  const l = { ...DEFAULT_ACHIEVEMENTS_MODAL_LABELS, ...labels };

  const knownIds = Object.keys(unlocked).filter((id) =>
    achievements.some((a) => a.id === id),
  );
  const totalPoints = knownIds.reduce((sum, id) => {
    const ach = achievements.find((a) => a.id === id);
    return ach ? sum + TIER_POINTS[ach.tier] : sum;
  }, 0);
  const maxPoints = achievements.reduce(
    (sum, a) => sum + TIER_POINTS[a.tier],
    0,
  );
  const unlockedCount = knownIds.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="achievements-title"
      closeLabel={l.close}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="achievements-title"
          className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <TrophyGlyph className="h-4 w-4 text-flag" />
          {l.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={l.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 text-sm">
        <div className="flex flex-col gap-8 leading-relaxed">
          <header className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-flag bg-flag/15 text-flag">
              <TrophyGlyph className="h-5 w-5" />
            </span>
            <p className="flex-1 text-xs text-muted">
              {l.counter({
                unlocked: unlockedCount,
                total: achievements.length,
                earned: totalPoints,
                max: maxPoints,
              })}
            </p>
          </header>

          <p>{l.intro}</p>

          {TIER_ORDER.map((tier) => (
            <TierSection
              key={tier}
              tier={tier}
              labels={l}
              tierGlyph={tierGlyphs[tier]}
              unlocked={unlocked}
              achievements={achievements.filter((a) => a.tier === tier)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function TierSection({
  tier,
  achievements,
  unlocked,
  labels,
  tierGlyph: Icon,
}: {
  tier: AchievementTier;
  achievements: readonly AchievementDisplay[];
  unlocked: UnlockedMap;
  labels: AchievementsModalLabels;
  tierGlyph: Glyph;
}) {
  const points = TIER_POINTS[tier];
  const tierMax = achievements.length * points;
  const tierEarned =
    achievements.filter((a) => unlocked[a.id] !== undefined).length * points;
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-surface-2 text-pipe">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="flex flex-col">
          <h3 className="text-base font-bold tracking-wide text-fg-bright">
            {labels.tier[tier].title}{" "}
            <span className="text-xs font-normal text-muted">
              {labels.tierPoints({ earned: tierEarned, max: tierMax })}
            </span>
          </h3>
          <p className="text-xs text-muted">{labels.tier[tier].subtitle}</p>
        </div>
      </header>
      <div className="flex flex-col gap-2">
        {achievements.map((ach) => (
          <AchievementRow
            key={ach.id}
            achievement={ach}
            unlockedAt={unlocked[ach.id]}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}

function AchievementRow({
  achievement,
  unlockedAt,
  labels,
}: {
  achievement: AchievementDisplay;
  unlockedAt: number | undefined;
  labels: AchievementsModalLabels;
}) {
  const Icon = achievement.glyph;
  const isUnlocked = unlockedAt !== undefined;
  const points = TIER_POINTS[achievement.tier];
  const learnMore = achievement.learnMore;
  return (
    <details
      className={
        isUnlocked
          ? "group rounded border border-line bg-surface px-3 py-2 open:bg-surface-2"
          : "group rounded border border-line bg-surface/60 px-3 py-2 open:bg-surface-2"
      }
    >
      <summary className="flex cursor-pointer list-none items-start gap-2">
        <span
          className={
            isUnlocked
              ? "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-flag bg-flag/15 text-flag"
              : "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-surface-2 text-muted"
          }
          aria-label={isUnlocked ? undefined : labels.locked}
        >
          {isUnlocked ? (
            <Icon className="h-[14px] w-[14px]" />
          ) : (
            <LockIcon className="h-3 w-3" />
          )}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={
                isUnlocked
                  ? "text-sm font-bold text-fg-bright"
                  : "text-sm font-bold text-muted"
              }
            >
              {achievement.name}
            </span>
            <span className="text-xs text-meta">+{points}</span>
            {isUnlocked && <CheckIcon className="h-3 w-3 text-success" />}
          </div>
          <p className={isUnlocked ? "text-xs text-fg" : "text-xs text-muted"}>
            {achievement.condition}
          </p>
          {learnMore ? (
            <span className="text-xs text-link group-open:hidden">
              {labels.learnMore}
            </span>
          ) : null}
        </div>
      </summary>
      {learnMore ? (
        <div className="mt-2 ml-8 text-muted">{learnMore}</div>
      ) : null}
    </details>
  );
}
