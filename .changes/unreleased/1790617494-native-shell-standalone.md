---
type: Changed
title: A native shell counts as standalone
---

`isStandaloneMobile()` / `useStandaloneMobile()` are now `true` inside a phone app's native shell (a `react-native-webview` host, or a wrapper that injects `window.__ossShell`), so the edge-swipe setting that hides the floating menu button is offered there as in the installed PWA; `isNativeShell()` and `nativeShellDescriptor()` expose the shell itself.
