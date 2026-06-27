---
type: Added
title: achievements module — gamification engine + trophy UI
---

A new `achievements` subpath export (`@niclaslindstedt/oss-framework/achievements`): a reusable gamification subsystem generic over your app's state. `useAchievementWatcher` derives unlocks from each state transition and drains a manual-unlock `bus` (`unlock(id)`); the pure `deriveUnlocks` runs the same logic standalone (e.g. a first-run retroactive award); and the UI — `AchievementsModal` (the four-tier tour), `AchievementUnlockModal` (the unlock celebration), and `TrophyButton` (a count-badged trophy) — renders any catalog of `Achievement<TState>` entries. Per-achievement copy lives on the entry and chrome strings are injectable via `labels`; your app keeps the catalog and the earned-ids store (the framework records through your `record` callback and never persists).
