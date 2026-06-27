---
type: Added
title: Save-path retry policy
---

The `storage` module now exports a pure save-retry policy — `backoffDelayMs` (equal-jitter exponential backoff), `isRetryableSaveError`, `MAX_TRANSIENT_SAVE_RETRIES`, and `OFFLINE_RESUME_MS` — so your app's save queue can ride out transient backend failures with a tested backoff curve.
