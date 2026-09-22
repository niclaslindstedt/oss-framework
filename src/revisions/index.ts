// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public revisions surface — the edit history of a record as the snapshots
// it has been. Pure arithmetic over a list; what the record is, when it was
// saved and where the list lives are the caller's. See ./README.md.
export {
  changedPaths,
  mergeRevisions,
  recordRevision,
  revisionAt,
  sameRecord,
  type Revision,
} from "./revisions.ts";
