// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The sync surface: a header status glyph and a command-centre modal over the
// app's own sync engine. The framework paints the state; your app owns the
// state machine and the actions. See ./README.md.

export { SyncStatus } from "./SyncStatus.tsx";
export { SyncDetailsModal } from "./SyncDetailsModal.tsx";
export type {
  SaveStatus,
  ConnectionProbeResult,
  BackendKind,
  SyncLocation,
} from "./types.ts";
export {
  DEFAULT_SYNC_STATUS_LABELS,
  DEFAULT_SYNC_DETAILS_LABELS,
  type SyncStatusLabels,
  type SyncDetailsLabels,
} from "./labels.ts";
