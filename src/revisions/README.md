<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `revisions` — the edit history of a record

What a record used to say. A history is a list of **snapshots** — the whole
record at the moment it was saved — and this module is the arithmetic over
that list: append a save, look up a date, merge two devices' lists, name what
changed.

```ts
import {
  changedPaths,
  mergeRevisions,
  recordRevision,
  revisionAt,
} from "@niclaslindstedt/oss-framework/revisions";

let history = recordRevision(
  [],
  { name: "Acme", city: "Malmö" },
  "2026-01-05T09:00:00Z",
);
history = recordRevision(
  history,
  { name: "Acme", city: "Malmö" },
  "2026-02-01T09:00:00Z",
);
// still one revision — a save that changed nothing is not a revision
history = recordRevision(
  history,
  { name: "Acme", city: "Lund" },
  "2026-03-10T09:00:00Z",
);

revisionAt(history, "2026-02-14T00:00:00Z")?.data.city; // "Malmö"
changedPaths(history[0].data, history[1].data); // ["city"]
mergeRevisions(history, historyFromTheOtherDevice); // the union, in stamp order
```

## Why snapshots, not diffs

A diff has to be replayed from the start, and a device that missed one in the
middle replays the rest wrong. A snapshot is read on its own: what the record
said on a date is the latest snapshot at or before it, whatever else is
missing. The cost is bytes, and a contact, a customer or a settings blob is a
few hundred of them. An app that versions something large — a document body —
wants the [`history`](../history/README.md) module's undo stacks instead, or a
diff of its own.

## The four rules

- **An unchanged save is not a revision.** `recordRevision` compares the new
  data to the latest snapshot structurally (`sameRecord`, key order ignored)
  and hands the list back untouched when nothing moved.
- **Stamp order, whatever the arrival order.** A snapshot stamped earlier than
  the latest — a clock set back, a save that arrived late — is filed where its
  stamp puts it.
- **Two histories merge as a union.** Snapshots are appended and never edited,
  so two devices' lists merge by stamp with nothing lost, which is what lets a
  last-edit-wins document merge carry a history along without a conflict of
  its own.
- **"Then" is a lookup.** `revisionAt` walks the sorted list and answers the
  snapshot in force at a moment, or `null` before the record existed.

`changedPaths` is the history screen's "changed: address.city, phone": the
dotted paths whose values differ between two snapshots, nested objects walked,
arrays compared whole.

## What stays in your app

When a save happens and what its stamp is (`at` — an ISO timestamp, or
anything that sorts as one); which fields of a record are worth keeping (pass
a projection, not the row with its ids and caches); where the list is stored
and how it reaches the other device. The module is pure, so every rule above
can be pinned in a node test.
