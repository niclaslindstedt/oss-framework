---
type: Added
title: Stored arrangements
---

The new `order` module applies a persisted list of ids back onto whatever
entries this build ships — dropping ids it no longer has, and leaving entries
the stored order predates where they were registered rather than piling them at
the end.
