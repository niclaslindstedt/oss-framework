// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public logging surface, available under the
// "@niclaslindstedt/oss-framework/logging" subpath.
//
// An in-app log store for local-first PWAs: a bounded ring buffer with an
// optional localStorage mirror and a pub/sub layer so a Logs panel can render
// it live, plus the formatting helpers that panel shares. The React store that
// drives a developer-mode toggle, and the panel's markup, stay in your app —
// the framework owns the buffer, its persistence, and the sink.

export {
  createLogStore,
  defaultLogStore,
  type LogEntry,
  type LogLevel,
  type LogStore,
  type LogStoreOptions,
  type ScopedLogger,
} from "./log-store.ts";

export { formatLogLine, formatLogTime } from "./format.ts";

export { useLogs } from "./useLogs.ts";
export {
  LogViewer,
  DEFAULT_LOG_VIEWER_LABELS,
  type LogViewerLabels,
} from "./LogViewer.tsx";
