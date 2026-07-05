---
type: Added
title: Calendar (slice 1)
---

New `calendar` module, first slice: importable iCalendar (RFC 5545) file
serialization — all-day events, yearly recurrence, text escaping, 75-octet
line folding — plus a pure recurring-date core (year-optional date parsing,
years-since, next-occurrence and days-until math with no DST-unsafe
millisecond arithmetic); the month-grid and date-picker components follow in
a later slice.
