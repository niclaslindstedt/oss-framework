import { useMemo } from "react";

import { CloseIcon } from "../components/icons.tsx";
import { Modal } from "../components/Modal.tsx";
import { TrophyGlyph } from "./glyphs.tsx";
import {
  DEFAULT_ACHIEVEMENT_UNLOCK_LABELS,
  type AchievementUnlockLabels,
} from "./labels.ts";
import { TIER_POINTS, type AchievementDisplay } from "./types.ts";

// Pops up to celebrate fresh unlocks the user hasn't acknowledged yet — NOT the
// full tour. Lists just the unseen ones, in the order given. Closing it (X,
// backdrop, or the dismiss button) is your cue to clear the unseen queue.
// Renders as a compact centered card.

type Props = {
  open: boolean;
  onClose: () => void;
  /** Your catalog (or any display-only view of it) to resolve ids against. */
  achievements: readonly AchievementDisplay[];
  /** The unacknowledged ids to celebrate. */
  unseenIds: readonly string[];
  labels?: Partial<AchievementUnlockLabels>;
};

export function AchievementUnlockModal({
  open,
  onClose,
  achievements,
  unseenIds,
  labels,
}: Props) {
  const l = { ...DEFAULT_ACHIEVEMENT_UNLOCK_LABELS, ...labels };
  const byId = useMemo(
    () => new Map(achievements.map((a) => [a.id, a])),
    [achievements],
  );
  const items = unseenIds
    .map((id) => byId.get(id))
    .filter((a): a is AchievementDisplay => a !== undefined);
  if (!open || items.length === 0) return null;
  const title = items.length === 1 ? l.titleOne : l.titleOther(items.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="achievement-unlock-title"
      closeLabel={l.close}
      centered
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="achievement-unlock-title"
          className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <TrophyGlyph className="h-4 w-4 text-flag" />
          {title}
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
        <div className="flex flex-col gap-2">
          {items.map((ach) => {
            const Icon = ach.glyph;
            return (
              <article
                key={ach.id}
                className="flex items-start gap-3 rounded border border-line bg-surface-2 px-3 py-2"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-flag bg-flag/15 text-flag">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-fg-bright">
                      {ach.name}
                    </span>
                    <span className="text-xs text-meta">
                      +{TIER_POINTS[ach.tier]}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{ach.condition}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end border-t border-line bg-surface-3 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded border border-accent bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/25 focus-visible:ring-2 focus-visible:ring-fg focus-visible:outline-none"
        >
          {l.dismiss}
        </button>
      </footer>
    </Modal>
  );
}
