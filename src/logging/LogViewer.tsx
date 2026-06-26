// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import { Button } from "../components/Button.tsx";
import { SelectPicker } from "../components/SelectPicker.tsx";
import { formatLogLine, formatLogTime } from "./format.ts";
import type { LogLevel, LogStore } from "./log-store.ts";
import { useLogs } from "./useLogs.ts";

// A live view of a {@link LogStore}'s buffer — the Logs panel both source apps
// grew, as a reusable component. It renders each entry as a coloured
// `HH:MM:SS LEVEL [scope]` header over its message, with a level filter, a
// "copy to clipboard" of the (filtered) lines, and a clear button. The store
// stays the app's (it owns the keys, the capture gate, the sink); the
// framework owns this read-only projection of it.
//
// Every visible string injects via `labels` (English defaults) so the panel
// carries no i18n. The level → colour mapping rides the theme's semantic slots
// (`meta` / `flag` / `negative` for info / warn / error, `link` for the scope)
// so it follows the active theme.

type LevelFilter = "all" | LogLevel;

export type LogViewerLabels = {
  filter: string;
  all: string;
  info: string;
  warn: string;
  error: string;
  copy: string;
  copied: string;
  clear: string;
  empty: string;
  // The "N entries." count line.
  entries: (n: number) => string;
};

export const DEFAULT_LOG_VIEWER_LABELS: LogViewerLabels = {
  filter: "Filter",
  all: "All",
  info: "Info",
  warn: "Warn",
  error: "Error",
  copy: "Copy",
  copied: "Copied",
  clear: "Clear",
  empty: "No log lines yet.",
  entries: (n) => `${n} ${n === 1 ? "entry" : "entries"}.`,
};

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-meta",
  warn: "text-flag",
  error: "text-negative",
};

type Props = {
  store: LogStore;
  // Tailwind max-height for the scrolling body; defaults to `max-h-64`.
  maxHeight?: string;
  labels?: Partial<LogViewerLabels>;
  className?: string;
};

export function LogViewer({
  store,
  maxHeight = "max-h-64",
  labels,
  className = "",
}: Props) {
  const text = { ...DEFAULT_LOG_VIEWER_LABELS, ...labels };
  const entries = useLogs(store);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [copied, setCopied] = useState(false);

  const shown = useMemo(
    () =>
      level === "all" ? entries : entries.filter((e) => e.level === level),
    [entries, level],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown.map(formatLogLine).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable (insecure context) — nothing to recover.
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {text.filter}
          <SelectPicker<LevelFilter>
            value={level}
            onChange={setLevel}
            ariaLabel={text.filter}
            options={[
              { value: "all", label: text.all },
              { value: "info", label: text.info },
              { value: "warn", label: text.warn },
              { value: "error", label: text.error },
            ]}
            placement={{ width: { kind: "min", minPx: 120 } }}
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={copy}
            disabled={shown.length === 0}
          >
            {copied ? text.copied : text.copy}
          </Button>
          <Button
            variant="secondary"
            onClick={() => store.clearLogs()}
            disabled={entries.length === 0}
          >
            {text.clear}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted tabular-nums">
        {text.entries(shown.length)}
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">{text.empty}</p>
      ) : (
        <div
          className={`${maxHeight} overflow-auto rounded-md border border-line bg-surface-2 p-2 font-mono text-xs leading-relaxed`}
        >
          {shown.map((e, i) => (
            <div
              key={i}
              className="border-b border-line/60 py-1 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-muted">{formatLogTime(e.ts)}</span>
                <span className={`font-medium ${LEVEL_CLASS[e.level]}`}>
                  {e.level.toUpperCase()}
                </span>
                <span className="text-link">[{e.scope}]</span>
              </div>
              <div className="break-words whitespace-pre-wrap text-fg">
                {e.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
