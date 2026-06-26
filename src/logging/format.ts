// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure formatting helpers an in-app Logs panel renders entries with. The
// level/rail colours are an app's own (they key off its design tokens), but
// the wall-clock timestamp and the single-line "copy to clipboard" rendering
// are identical wherever a buffer is shown, so they live here.

import type { LogEntry } from "./log-store.ts";

/** A log entry's timestamp as a zero-padded local `HH:MM:SS`. */
export function formatLogTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * One entry as a single plain-text line — `HH:MM:SS [scope] LEVEL message` —
 * the shape a "Copy logs" button joins with newlines for a bug report.
 */
export function formatLogLine(entry: LogEntry): string {
  return `${formatLogTime(entry.ts)} [${entry.scope}] ${entry.level.toUpperCase()} ${entry.message}`;
}
