// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Injectable English-default strings for the sync surface. Every visible
// string is a label so an i18n app threads its own translator through; the
// interpolated ones (a backend name, a count) are `(name) => string`.

/** Strings for the header glyph (`SyncStatus`). */
export type SyncStatusLabels = {
  saving: string;
  /** "Synced to {name}". */
  syncedTo: (name: string) => string;
  saveUnsaved: string;
  failed: string;
  throttled: string;
  reauthRequired: string;
  syncConflict: string;
  offline: string;
};

export const DEFAULT_SYNC_STATUS_LABELS: SyncStatusLabels = {
  saving: "Saving…",
  syncedTo: (name) => `Synced to ${name}`,
  saveUnsaved: "Unsaved changes — tap to save now",
  failed: "Sync failed — tap for details",
  throttled: "Slow down — the backend is rate-limiting saves",
  reauthRequired: "Reconnect needed — tap to fix",
  syncConflict: "Sync conflict — tap to resolve",
  offline: "Offline — editing a local copy",
};

/** Strings for the command centre (`SyncDetailsModal`). */
export type SyncDetailsLabels = {
  cloudSync: string;
  close: string;
  status: string;
  backend: string;
  fileLocation: string;
  encryptionLabel: string;
  encryptionOn: string;
  encryptionOff: string;
  reloadFromBackend: string;
  saveNow: string;
  tryAgain: string;
  /** "Reconnect {name}". */
  reconnect: (name: string) => string;
  /** "Open in {name}". */
  openIn: (name: string) => string;
  checkConnection: string;
  /** "Reaching {name}…". */
  checkPinging: (name: string) => string;
  /** "Still can't reach {name}. …". */
  checkStillOffline: (name: string) => string;
  /** "Your session with {name} has expired — reconnect to continue.". */
  checkAuthExpired: (name: string) => string;
  viewSyncLog: string;
  hideSyncLog: string;
  // Per-state heading + the "what / why" line beneath it.
  syncingNow: string;
  failedHeading: string;
  /** Fallback detail when the engine gives no `statusDetail`. */
  failedDetailFallback: (name: string) => string;
  throttledHeading: string;
  throttledDetail: (name: string) => string;
  reauthHeading: string;
  reauthDetail: (name: string) => string;
  conflictHeading: string;
  conflictDetail: string;
  pendingHeading: string;
  pendingDetail: (name: string) => string;
  offlineHeading: string;
  offlineDetail: (name: string) => string;
  /** The synced (clean) headline — "Synced to {name}". */
  syncedTo: (name: string) => string;
};

export const DEFAULT_SYNC_DETAILS_LABELS: SyncDetailsLabels = {
  cloudSync: "Cloud sync",
  close: "Close",
  status: "Status",
  backend: "Backend",
  fileLocation: "File location",
  encryptionLabel: "Encryption",
  encryptionOn: "On",
  encryptionOff: "Off",
  reloadFromBackend: "Reload from the backend",
  saveNow: "Save now",
  tryAgain: "Try again",
  reconnect: (name) => `Reconnect ${name}`,
  openIn: (name) => `Open in ${name}`,
  checkConnection: "Check connection",
  checkPinging: (name) => `Reaching ${name}…`,
  checkStillOffline: (name) =>
    `Still can't reach ${name}. Your edits are saved on this device and will sync automatically once you're back online.`,
  checkAuthExpired: (name) =>
    `Your session with ${name} has expired — reconnect to continue.`,
  viewSyncLog: "View sync log",
  hideSyncLog: "Hide sync log",
  syncingNow: "Saving your changes…",
  failedHeading: "Sync failed",
  failedDetailFallback: (name) =>
    `The last save to ${name} didn't go through. Try again — and if it keeps failing, check your connection.`,
  throttledHeading: "Rate limited",
  throttledDetail: (name) =>
    `${name} is asking the app to slow down. Saving will resume automatically in a moment.`,
  reauthHeading: "Reconnect needed",
  reauthDetail: (name) =>
    `Your session with ${name} has expired. Reconnect to keep saving.`,
  conflictHeading: "Sync conflict",
  conflictDetail:
    "Another device saved a newer version. Open the document to pick which copy to keep.",
  pendingHeading: "Waiting to sync",
  pendingDetail: (name) => `Your latest edits aren't saved to ${name} yet.`,
  offlineHeading: "Offline",
  offlineDetail: (name) =>
    `Can't reach ${name} right now, so you're working on the copy saved on this device. Any changes are kept locally and sync automatically when you're back online.`,
  syncedTo: (name) => `Synced to ${name}`,
};
