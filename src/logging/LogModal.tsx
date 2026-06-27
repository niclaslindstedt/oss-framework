// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, type ReactNode } from "react";

import { Button } from "../components/Button.tsx";
import { CloseIcon, ScrollTextIcon } from "../components/icons.tsx";
import { Modal } from "../components/Modal.tsx";
import { formatLogTime } from "./format.ts";
import type { LogLevel } from "./log-store.ts";

// A modal that shows the full step-by-step log of a *single* operation — the
// sequence of lines one async, multi-step job emitted while it ran. It is the
// focused counterpart to {@link LogViewer}: where the viewer renders a live
// {@link LogStore} buffer (everything, with filters), this shows one
// operation's trace, opened on demand — typically when a status line goes red
// and the user taps it to read what happened and what stopped it.
//
// It owns no state: pass the entries you collected for the operation and the
// open/close control. Every visible string injects via `labels` (English
// defaults) so the modal carries no i18n, and the header glyph is a prop so an
// app can theme it to the operation (a shield for an encryption run, a cloud
// for a sync). The level → colour mapping rides the theme's semantic slots, so
// it follows the active theme exactly like the rest of the framework.

/**
 * One already-rendered line in a {@link LogModal}: a wall-clock timestamp, a
 * severity, and a human-readable string the app has already produced (and, if
 * it has i18n, already translated). Unlike the log store's `LogEntry` it
 * carries no `scope` — a LogModal is scoped to one operation, so the scope is
 * implicit and `text` is exactly what the user reads.
 */
export type LogModalEntry = {
  ts: number;
  level: LogLevel;
  text: string;
};

export type LogModalLabels = {
  title: string;
  empty: string;
  close: string;
};

export const DEFAULT_LOG_MODAL_LABELS: LogModalLabels = {
  title: "Activity log",
  empty: "Nothing logged yet.",
  close: "Close",
};

// info / warn / error → the theme's semantic text + left-rail slots. `warn`
// uses the caution slot (`flag`) and `error` the danger slot, matching the
// framework's other log and status surfaces so a buffer and a single-op log
// read the same within one app.
const TEXT_CLASS: Record<LogLevel, string> = {
  info: "text-fg",
  warn: "text-flag",
  error: "text-danger",
};

const RAIL_CLASS: Record<LogLevel, string> = {
  info: "border-l-accent",
  warn: "border-l-flag",
  error: "border-l-danger",
};

type Props = {
  open: boolean;
  entries: LogModalEntry[];
  onClose: () => void;
  /**
   * The header glyph. Defaults to a neutral scroll/log icon; pass your own
   * (e.g. a `ShieldIcon` for an encryption op, a `CloudIcon` for a sync) to
   * theme the modal to the operation it logs.
   */
  icon?: ReactNode;
  labels?: Partial<LogModalLabels>;
};

export function LogModal({ open, entries, onClose, icon, labels }: Props) {
  const text = { ...DEFAULT_LOG_MODAL_LABELS, ...labels };
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      centered
      closeLabel={text.close}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          {icon ?? <ScrollTextIcon className="h-4 w-4" />}
          {text.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
        {entries.length === 0 ? (
          <p className="text-xs text-muted">{text.empty}</p>
        ) : (
          <ul className="flex flex-col rounded border border-line bg-surface-2 font-mono text-xs">
            {entries.map((entry, idx) => (
              <li
                key={`${entry.ts}-${idx}`}
                className={`flex items-baseline gap-2 border-b border-l-2 border-line px-2.5 py-1.5 last:border-b-0 ${RAIL_CLASS[entry.level]}`}
              >
                <span className="shrink-0 text-muted tabular-nums">
                  {formatLogTime(entry.ts)}
                </span>
                <span
                  className={`min-w-0 flex-1 break-words whitespace-pre-wrap ${TEXT_CLASS[entry.level]}`}
                >
                  {entry.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
        <Button variant="secondary" onClick={onClose}>
          {text.close}
        </Button>
      </footer>
    </Modal>
  );
}
