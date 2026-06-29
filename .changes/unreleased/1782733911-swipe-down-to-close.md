---
type: Added
title: Swipe down to close a modal sheet
---

A `useSwipeDownToClose` hook (in `/hooks`) drives the mobile bottom-sheet dismiss gesture, and the full-screen `Modal` layout now wires it up: a downward drag that starts on the header — or in content already scrolled to its top — pulls the card with the finger and closes it past the threshold, while a mid-scrolled region keeps the touch as a normal scroll. Touch-only, and centered cards (confirmations, pickers) opt out.
