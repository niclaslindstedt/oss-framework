<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/pwa`

The Progressive-Web-App glue an installable, local-first app needs around its
service worker: a **prompt-to-update** lifecycle (track a new build, surface a
soft "reload to apply" prompt, apply it on the user's say-so) and
**install-context detection** (is this an installed PWA on a phone?). Both were
near-identical copies in the source apps; the framework owns the drift-prone
state machine and the prompt UI, the host owns the service-worker build.

| Export                  | What it is                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `usePwaUpdate(config)`  | Singleton hook driving the SW update lifecycle: download `progress`, `needRefresh`, `reload`, `dismiss`. |
| `UpdateToast`           | Presentational "a new version is ready" prompt — drive it from `usePwaUpdate`'s state.                   |
| `isStandaloneMobile()`  | `true` when running as an installed PWA on Android/iOS (where hiding chrome / edge gestures is safe).    |
| `useStandaloneMobile()` | The same flag as a hook (read once — it can't change without a reload).                                  |

## What it owns vs. what stays in your app

- **The framework owns** the update **state machine** (register the SW via
  `workbox-window`, poll the precache cache for download progress, flip
  `needRefresh` on the `waiting` event, apply on demand) and the prompt
  **markup** (`UpdateToast`).
- **Your app owns** the **service-worker build** — the `sw.js`, the
  `version.json` and `precache-manifest.json` the hook fetches, and the precache
  `cacheId` they were built with (typically a `vite-plugin-pwa` / Workbox
  setup). It also owns **where the prompt mounts** and the **strings** it shows.

## Contract

`usePwaUpdate` reads three files served under your app's `base` and one Cache
Storage entry. They must line up with your SW build:

| The hook fetches / reads        | Your build must produce                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `${base}sw.js`                  | The registered service worker.                                                                                                    |
| `${base}version.json`           | `{ "version": "<label>" }` — the **incoming** build's version, shown in the prompt. Optional (falls back to no version line).     |
| `${base}precache-manifest.json` | `{ "totalBytes": <n>, "assets": { "<pathname>": <bytes>, … } }` — drives the 0..100 download fill. Optional (no fill without it). |
| `<cacheId>-precache*` cache     | Your Workbox precache, named from the `cacheId` you pass.                                                                         |

The update strategy is **prompt, never silent**: the new SW installs and parks
in `waiting`; the framework does not call `skipWaiting()`/`clientsClaim` for
you — a silent swap would discard an in-progress edit. `reload()` posts
`SKIP_WAITING` and the `controlling` listener reloads once the new worker takes
over.

`UpdateToast` is viewport-`fixed`. On a layout with a docked sidebar it reads
the `--app-content-{left,right}` CSS variables the
[`sidebar`](../sidebar/README.md) module's `useSidebarInset` publishes, so it
centres over the content band rather than the whole window. Both default to
`0px`, so without a sidebar nothing shifts.

## Optional peer dependency

`workbox-window` is an **optional peer dependency**. `usePwaUpdate` imports it
lazily (`import("workbox-window")`) and only in a production browser with a
service worker, so apps that never call the hook pay nothing. Install it where
you use the hook:

```sh
npm i workbox-window
```

The framework keeps the specifier external; your bundler resolves and ships it.

## Usage

```tsx
import { usePwaUpdate, UpdateToast } from "@niclaslindstedt/oss-framework/pwa";

function UpdatePrompt() {
  // Config is the seam: pass your bundler's base, the precache cacheId your SW
  // build used, and whether to register at all (skip in dev). The first call
  // wins — the singleton registers one service worker.
  const update = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: "my-app",
    enabled: !import.meta.env.DEV,
  });

  return (
    <UpdateToast
      needRefresh={update.needRefresh}
      incomingVersion={update.incomingVersion}
      onReload={update.reload}
      onDismiss={update.dismiss}
    />
  );
}
```

`usePwaUpdate` also exposes `progress` (0..100 while a new build downloads, else
`null`) — the same singleton state can feed a second surface, e.g. a header
wordmark that fills as the download lands. That is exactly why the hook is a
singleton and `UpdateToast` is presentational: one driver, many views.

`isStandaloneMobile()` / `useStandaloneMobile()` gate affordances that are only
safe inside an installed window:

```tsx
const installed = useStandaloneMobile();
// e.g. only offer an inward edge-swipe gesture (which would fight the
// browser's back-swipe in a tab) when there is no browser chrome:
{
  installed && <EdgeSwipeSetting />;
}
```

## Migration

Replacing a home-grown SW-update prompt:

- **Delete** your update singleton (the `useSyncExternalStore` store, the
  workbox registration, the precache-progress polling) and import
  `usePwaUpdate`. Move the two app-specific bits to its `config`: your `DEV`
  flag → `enabled`, your `BASE_URL` → `base`, and your precache cache id →
  `cacheId` (resolve any per-deploy-slot suffix like `-preview` on your side
  before passing it).
- **Replace** your prompt component with `UpdateToast`, fed from the hook's
  state. If your prompt called the update hook internally, invert it: the hook
  goes up one level, `UpdateToast` takes props.
- **Translate** the strings via the `labels` prop (English defaults). Override
  `version` to format the version line your way.

```tsx
// before: a self-contained prompt that called the hook inside
<MyUpdateToast />;

// after: the hook lifts up; the prompt is presentational
const u = usePwaUpdate({ base, cacheId, enabled });
<UpdateToast
  needRefresh={u.needRefresh}
  incomingVersion={u.incomingVersion}
  onReload={u.reload}
  onDismiss={u.dismiss}
  labels={{ ready: t("pwa.updateReady"), action: t("pwa.updateAction") }}
/>;
```

### Partial match

Most adopters differ from the framework somewhere — reconcile your case:

- **You have no `precache-manifest.json`.** `progress` simply stays at its
  coarse values (`null` → `100` on `waiting`); the prompt still works, only the
  fine-grained download fill is unavailable. Add the manifest emit to your SW
  build to light it up.
- **You have no `version.json`.** `incomingVersion` is `null` and the version
  line is hidden — the prompt still shows. Add the file to surface the label.
- **Your precache `cacheId` differs per deploy slot** (e.g. `app`,
  `app-preview`). The framework takes a single resolved `cacheId`; compute it on
  your side (the same place your SW build derives it) and pass the result.
- **You register the SW elsewhere** (a plugin's auto-injected `useRegisterSW`).
  Don't — let `usePwaUpdate` register, so `updateViaCache: "none"` is applied
  and update checks actually re-fetch `sw.js` from the network. Disable the
  auto-register in your plugin config.
- **Your prompt needs different chrome** (an icon, a progress bar inside the
  toast, a different position). `UpdateToast` is a thin presentational
  component; if it doesn't fit, render your own markup from the same
  `usePwaUpdate` state — the hook is the reusable part.
- **You also want a download-progress surface.** Read `progress` from the same
  `usePwaUpdate()` call in that component; the singleton fans one state out to
  every subscriber.

## Verification

- Build a production bundle with your SW, deploy a new build, and confirm the
  prompt appears once the new worker reaches `waiting`; pressing the action
  reloads onto the new build and dismissing hides it until a fresher one lands.
- In dev (`enabled: false`) confirm nothing registers and the prompt never
  shows.
- On an installed phone PWA confirm `isStandaloneMobile()` is `true` and is
  `false` in a normal browser tab.
