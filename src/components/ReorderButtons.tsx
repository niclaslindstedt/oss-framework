// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// A stacked up/down pair for hand-ordering a list of rows — the keyboard- and
// mouse-friendly alternative to a drag handle, and the one that fits where a
// row has no width to spend (the framework's `useDragDrop` covers the
// touch-first gesture when it does).
//
// The two chevrons sit tight in one column so they cost the row almost
// nothing, and each disables itself at the end of the list it can't move past,
// so the top row can't move up and the bottom row can't move down.

import { ChevronDownIcon, ChevronUpIcon } from "./icons.tsx";

export type ReorderButtonsProps = {
  /** Accessible name / tooltip for the up control ("Move earlier"). */
  upLabel: string;
  /** Accessible name / tooltip for the down control ("Move later"). */
  downLabel: string;
  /** False on the first row — the control disables rather than disappearing,
   *  so the column keeps its width and the rows stay aligned. */
  canMoveUp: boolean;
  /** False on the last row. */
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function ReorderButtons({
  upLabel,
  downLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ReorderButtonsProps) {
  const btn =
    "flex h-3.5 w-7 cursor-pointer items-center justify-center text-muted hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:text-muted";
  return (
    <span className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={upLabel}
        title={upLabel}
        className={btn}
      >
        <ChevronUpIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={downLabel}
        title={downLabel}
        className={btn}
      >
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    </span>
  );
}
