---
type: Added
title: Sign in from a desktop shell
---

`isDesktopShellOrigin`, `runLoopbackAuth` and `connectDropboxLoopback` complete an OAuth sign-in in a desktop shell, where the redirect has nowhere to land: consent opens in the user's browser and the shell's loopback listener hands the result back. `completeAuth` takes the redirect URI to replay as an optional fourth argument.
