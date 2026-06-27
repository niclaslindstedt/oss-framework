---
type: Added
title: Manual "check for updates" for the pwa module
---

`pwa`: `usePwaUpdate` now exposes `checkForUpdate()` — an on-demand probe for a newer build (resolving `"update-found"` / `"up-to-date"` / `"unavailable"`, re-surfacing a dismissed prompt and a `checking` flag while it runs) — and a presentational `CheckForUpdatesItem` footer/menu row that drives it, owning the spinner, the "you're up to date" / "update available" feedback, and the `aria-live` wiring so an adopter only feeds it the update state and its strings.
