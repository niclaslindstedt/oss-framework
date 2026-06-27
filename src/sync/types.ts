// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The sync-surface contract. These are the shapes the header glyph
// (`SyncStatus`) and the command centre (`SyncDetailsModal`) render over —
// the app's sync engine produces them, the framework only paints them.

/**
 * The lifecycle of the save path, as the user-facing sync surface sees it.
 * Your sync engine owns the state machine; these are the states it surfaces:
 *
 * - `idle` / `saved` — nothing in flight. Pair with `dirty` to tell "all
 *   pushed" (clean) from "edits waiting to push" (dirty).
 * - `saving` — a write is in flight.
 * - `error` — the last write failed for a generic/transient reason.
 * - `conflict` — the backend holds a newer copy; needs the user to resolve.
 * - `auth-error` — the backend session expired; needs a reconnect.
 * - `throttled` — the backend is rate-limiting; saving resumes on its own.
 */
export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "auth-error"
  | "throttled";

/**
 * What an active reachability probe found. Returned by `onCheckConnection`
 * so the "Check connection" button can report the outcome inline; the actual
 * recovery (re-read + flush the queue) happens engine-side.
 */
export type ConnectionProbeResult = "online" | "offline" | "auth-error";

/**
 * Which glyph family names the backend in the details grid — a cloud for a
 * hosted backend, a folder for a picked local directory.
 */
export type BackendKind = "cloud" | "folder";

/** Where the document lives, as shown in the command centre. */
export type SyncLocation = {
  /** Human-readable path the user sees when browsing the backend. */
  path: string;
  /** Web UI URL for the backend, or null/omitted when it can't be opened. */
  url?: string | null;
};
