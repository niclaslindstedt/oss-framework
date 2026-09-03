---
type: Added
title: Device-local records and bulk-transfer politeness
---

`createIdbStore` gives an app a best-effort keyed record store over IndexedDB
for what a device keeps rather than what a backend holds, and
`mapLimit` / `withTransientRetries` keep a sweep over hundreds of files inside
a provider's throttle and a browser's connection budget.
