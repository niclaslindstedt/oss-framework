---
type: Added
title: Reading the clipboard
---

`readClipboard` / `readDataTransfer` are the read half `useClipboard` never
had — one look that hands back every flavour at once (so a menu's Paste raises
the system prompt once rather than per type), with `clipboardLookIsFree` to tell
a free peek from one the user has to answer.
