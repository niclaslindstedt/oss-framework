---
type: Changed
title: LogViewer shows the newest line first
---

The `LogViewer` panel (the one the sync command centre's "View sync log"
section renders) now orders entries newest-first instead of buffer order, and
takes an `order` prop — `"newest-first"`, `"oldest-first"`, or a `LogEntry`
comparator — that also governs what "Copy" writes.
