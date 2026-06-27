import { TrophyGlyph } from "./glyphs.tsx";
import {
  DEFAULT_TROPHY_BUTTON_LABELS,
  type TrophyButtonLabels,
} from "./labels.ts";

// A self-contained trophy button with an unseen-count badge. Quiet (muted glyph,
// no badge) when nothing is new; lit (accent glyph, count badge) when there are
// unacknowledged unlocks. Purely presentational — the caller decides what
// `onClick` opens (the tour when quiet, the unlock modal when lit, both keyed
// off the same `unseenCount` it passed in).

type Props = {
  unseenCount: number;
  onClick: () => void;
  labels?: Partial<TrophyButtonLabels>;
  /** Override the wrapper classes to seat the button in your chrome. */
  className?: string;
};

export function TrophyButton({
  unseenCount,
  onClick,
  labels,
  className = "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg",
}: Props) {
  const l = { ...DEFAULT_TROPHY_BUTTON_LABELS, ...labels };
  const lit = unseenCount > 0;
  const label = lit ? l.unseen(unseenCount) : l.open;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
    >
      <span className={lit ? "text-flag" : undefined}>
        <TrophyGlyph className="h-5 w-5" />
      </span>
      {lit && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-flag px-1 py-0.5 text-[10px] leading-none font-bold text-page-bg tabular-nums">
          {unseenCount}
        </span>
      )}
    </button>
  );
}
