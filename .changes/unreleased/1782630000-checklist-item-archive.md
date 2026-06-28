---
type: Added
title: Archive checklist items
---

`Checklist` rows can now be archived: wire `onArchive` and a right swipe flicks a row to the archive (left still reveals Delete), backed by the new `setNodeArchived` tree helper and archived-aware `flattenForDisplay` / `countProgress`.
