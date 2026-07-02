---
type: Added
title: applyUnlocks
---

New `applyUnlocks` / `clearUnseen` pure helpers (over an `UnlockLedger`) in the
`achievements` module implement the idempotent unlock, genuinely-new-ids
return, and unseen-queue mechanics the `useAchievementWatcher` `record`
contract requires — logic every adopter previously hand-rolled. The store (and
where the ledger lives) stays app-side.
