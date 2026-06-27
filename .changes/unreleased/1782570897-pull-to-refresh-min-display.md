---
type: Changed
title: Pull-to-refresh owns its anti-flicker floor
---

`usePullToRefresh` now holds the `"refreshing"` state for a minimum display window (default 600ms, via a new `minDisplayMs` option) so a near-instant local-first refresh no longer snaps the spinner away before it registers — adopters can drop the hand-rolled `setTimeout` pad they used to wrap `onRefresh` in.
