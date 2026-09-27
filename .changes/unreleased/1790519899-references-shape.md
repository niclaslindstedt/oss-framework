---
type: Changed
title: References audit checks summary and topics shape
---

`auditReferences` now holds a present `summary` and `topics` to the shape OSS_SPEC 2.11.0 §24.2 gives them — a summary keyed by language tag with no blank line, topics a non-empty list of kebab-case names — even when no `languages` or `topics` option is passed.
