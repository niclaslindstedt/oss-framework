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
//
// Two forms, picked by `showLabel`: the compact icon-only button (default —
// fits a header or toolbar), and a full-width menu row (the quiet label beside
// the glyph, the badge inline after it) that drops in among sidebar footer
// rows. Either form's wrapper classes can be replaced via `className`.

// The compact icon button (default) and the full-width menu row. The row shape
// matches the framework's other menu rows (`px-5`, the density vertical
// padding, `gap-3`, `h-5` glyph) so the trophy reads as one continuous list
// with the footer items around it.
const ICON_CLASS =
  "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg";
const ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright";

type Props = {
  unseenCount: number;
  onClick: () => void;
  labels?: Partial<TrophyButtonLabels>;
  /**
   * Render the quiet label text beside the glyph as a full-width menu row (e.g.
   * seated among sidebar footer rows); when lit, the count badge follows the
   * label inline. Omit for the compact icon-only button.
   */
  showLabel?: boolean;
  /**
   * Override the wrapper classes to seat the button in your chrome. Defaults to
   * the icon button, or the menu row when `showLabel` is set.
   */
  className?: string;
};

export function TrophyButton({
  unseenCount,
  onClick,
  labels,
  showLabel = false,
  className,
}: Props) {
  const l = { ...DEFAULT_TROPHY_BUTTON_LABELS, ...labels };
  const lit = unseenCount > 0;
  const label = lit ? l.unseen(unseenCount) : l.open;
  const wrapperClass = className ?? (showLabel ? ROW_CLASS : ICON_CLASS);
  // Quiet glyph dims in the row form so the lit state reads clearly against the
  // surrounding rows; the icon form leans on its wrapper's muted colour.
  const glyphClass = lit
    ? "text-flag"
    : showLabel
      ? "text-muted/50"
      : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={wrapperClass}
    >
      <span className={glyphClass}>
        <TrophyGlyph className="h-5 w-5" />
      </span>
      {showLabel && <span className="flex-1">{l.open}</span>}
      {lit &&
        (showLabel ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-flag px-1.5 py-0.5 text-xs leading-none font-bold text-page-bg tabular-nums">
            {unseenCount}
          </span>
        ) : (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-flag px-1 py-0.5 text-[10px] leading-none font-bold text-page-bg tabular-nums">
            {unseenCount}
          </span>
        ))}
    </button>
  );
}
