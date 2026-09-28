<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Running inside a native shell

An app built on the framework can ship the same web build three ways: as a
website in a browser tab, as an installed PWA, and inside a **native shell** — a
thin native app (Expo / React Native, `react-native-webview`) that serves the
built site from a loopback origin and shows it full screen. This page is the
contract between the page and such a shell: how the page knows it is in one,
and the messages the two exchange.

The page learns everything from what the shell itself puts on `window`. Nothing
is guessed from a user agent, and nothing is compiled in: the same bundle runs
in a tab, an installed window and a shell.

## Recognizing the shell

`isNativeShell()` (from `@niclaslindstedt/oss-framework/pwa`) is `true` when
either of these is present:

| Signal                                          | Who puts it there                                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.ReactNativeWebView.postMessage`         | `react-native-webview`, before the page's scripts run, in any `<WebView>` given an `onMessage` prop. A shell that listens to its page at all has it already.                        |
| `window.__ossShell = { version, capabilities }` | The shell, in `injectedJavaScriptBeforeContentLoaded`. Declares the shell (for a wrapper that is not `react-native-webview`) and lists the message contracts it implements (below). |

A native shell on a phone has no browser chrome — no address bar, no browser
back-swipe owning the screen edge — so `isStandaloneMobile()` /
`useStandaloneMobile()` count it as standalone, exactly like an installed PWA.

### Opting an app in: the edge-swipe setting

An app that offers "swipe from the edge to open the menu" (and with it, hiding
the floating menu button) gates that setting on `useStandaloneMobile()`. With
this release the gate opens inside the shell too, so the app itself changes
nothing beyond the framework version. What each piece needs:

- **The web app** gates the setting (and the `useEdgeSwipeOpen` /
  `showButton={false}` wiring it drives) on `useStandaloneMobile()` from the
  framework — not on a local copy of the old detection, and not on a
  `__NATIVE_BUILD__`-style compile-time flag.
- **The shell** passes `onMessage` to its `<WebView>` (every fleet shell does,
  for its theme reporter). Nothing else. A wrapper that is not
  `react-native-webview` injects `window.__ossShell = { version: 1,
capabilities: [] }` instead.

## The descriptor

A shell that implements any of the message contracts below advertises it, before
the page loads, in `window.__ossShell`:

```js
// injectedJavaScriptBeforeContentLoaded
window.__ossShell = window.__ossShell || { version: 1, capabilities: [] };
```

`version` is the descriptor's version (`1`). `capabilities` is a list of
contract names. The page uses a contract only when its name is listed **and**
the `ReactNativeWebView` bridge is present, so a shell that has not implemented
one keeps the web behavior rather than posting into the void.
