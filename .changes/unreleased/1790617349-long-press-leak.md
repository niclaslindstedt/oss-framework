---
type: Fixed
title: A long press no longer lifts into a tap
---

`useLongPress` swallows the click that ends the press however long it was held — before, a hold past about 0.9 s let that click through and activated the element underneath.
