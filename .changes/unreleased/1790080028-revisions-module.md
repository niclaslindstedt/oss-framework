---
type: Added
title: revisions module
---

A `revisions` module for a record's edit history as snapshots: `recordRevision` skips a save that changed nothing and keeps the list in stamp order, `revisionAt` answers what the record said on a date, `mergeRevisions` unions two devices' histories, and `changedPaths` names the fields that differ between two versions.
