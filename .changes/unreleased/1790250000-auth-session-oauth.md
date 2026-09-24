---
type: Added
title: Sign in from a phone app through an authentication session
---

`getAuthSessionHost`, `runAuthSessionAuth` and `connectDropboxAuthSession` complete an OAuth sign-in in a phone wrapper, where the redirect would land in the system browser instead of the app: a host that offers an authentication session (`window.__ossAuthSession`) opens consent in a browser sheet over the app and hands the callback back, and the page finishes the PKCE exchange itself. `isAuthCancelled` tells a closed sheet apart from a failure.
