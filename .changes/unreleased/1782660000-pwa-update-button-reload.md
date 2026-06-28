---
type: Fixed
title: PWA update button now reloads
---

`usePwaUpdate().reload()` now reloads the page once the new service worker takes over even when no worker controlled the page at registration time, so tapping "Update" in the toast applies the build instead of leaving the prompt up.
