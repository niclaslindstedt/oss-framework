// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useSyncExternalStore } from "react";
import type { Workbox } from "workbox-window";

// Single source of truth for the PWA update lifecycle. The state it tracks —
// download progress and the "a new build is ready" flag — typically feeds more
// than one surface at once (a reload prompt like `UpdateToast`, and optionally
// a header wordmark / progress bar that fills while a build downloads). Those
// surfaces mount independently, so registration and progress tracking live in a
// module singleton here rather than inside any one component; the first
// subscriber starts it, and `useSyncExternalStore` fans the state out to all
// consumers.
//
// We register the service worker ourselves via `workbox-window` rather than a
// PWA plugin's auto-injected `useRegisterSW`, because that register call may
// not forward `updateViaCache: "none"`, so an HTTP-cached `sw.js` can satisfy
// update checks indefinitely (the SW spec only forces a cache bypass once the
// cached SW is over 24h old). With `updateViaCache: "none"` every
// `reg.update()` re-fetches the SW script from the network.
//
// Update strategy stays "prompt": the new SW installs and parks in the
// `waiting` state, we flip `needRefresh` from the workbox `waiting` event, and
// the user applies it at a moment of their choosing. We deliberately do NOT
// `skipWaiting()` from the SW or `clientsClaim` — the page would silently swap
// to new JS, breaking in-progress edits.
//
// Download progress: a precaching SW fetches its assets during the `install`
// event, but workbox exposes no progress API. Instead we watch the shared
// precache Cache Storage from the window: each asset workbox finishes fetching
// lands in the cache, so summing the byte sizes (from the build-time
// `precache-manifest.json`) of the entries already present, against the
// manifest total, yields a real percentage. Content-hashed assets — the bulk of
// the bytes — change URL every build, so they only count once the new SW
// actually downloads them, which is what makes the fill track the real
// transfer.

export type PwaUpdateConfig = {
  // Base URL the service worker, `version.json`, and `precache-manifest.json`
  // are served under (e.g. `"/"` or `"/app/"`). Used both as the SW scope and
  // to build the manifest fetch URLs. Pass your bundler's base (Vite:
  // `import.meta.env.BASE_URL`).
  base: string;
  // The workbox precache cache id, matching the one the SW build was configured
  // with. Progress is read from the `<cacheId>-precache-*` Cache Storage entry;
  // a wrong id simply means the fill never advances. Resolve any per-deploy-slot
  // suffix (e.g. `-preview`) on the app side before passing it.
  cacheId: string;
  // When false, registration is skipped entirely and the state stays idle — use
  // for dev builds with no service worker (Vite: `!import.meta.env.DEV`).
  // Defaults to true.
  enabled?: boolean;
};

export type PwaUpdateState = {
  // 0..100 while a new build is downloading or sitting ready; null when
  // idle (no update in flight). Drives a download/progress affordance.
  progress: number | null;
  // True once a new build has fully installed and is waiting to take over.
  // Drives the reload prompt.
  needRefresh: boolean;
  // Version label of the incoming build (from `version.json`), or null for
  // a deploy predating that file / while offline.
  incomingVersion: string | null;
  // True while a manual `checkForUpdate()` probe is in flight — drives a
  // "checking…" affordance on a "check for updates" control. The automatic
  // hourly / visibility-change checks do not flip this; only an explicit call.
  checking: boolean;
};

// Outcome of a manual `checkForUpdate()`:
//   "update-found"  — a build is downloading or already waiting; the prompt
//                     will appear (or was re-surfaced). The host needn't react.
//   "up-to-date"    — the running build is the newest; show a brief reassurance.
//   "unavailable"   — no service worker to check against (dev build, an
//                     unsupported browser, or registration failed).
export type PwaUpdateCheckResult =
  | "update-found"
  | "up-to-date"
  | "unavailable";

const HOUR_MS = 60 * 60 * 1000;
const POLL_MS = 200;

let state: PwaUpdateState = {
  progress: null,
  needRefresh: false,
  incomingVersion: null,
  checking: false,
};
const listeners = new Set<() => void>();
let wb: Workbox | null = null;
// The active registration, kept so a manual `checkForUpdate()` can call
// `reg.update()` and inspect whether a new worker showed up. Null until the
// service worker registers (and on dev / unsupported builds, never set).
let reg: ServiceWorkerRegistration | null = null;
// De-dupes overlapping manual checks: a second tap while one is in flight
// joins the same probe rather than firing a second `reg.update()`.
let checkInFlight: Promise<PwaUpdateCheckResult> | null = null;
let started = false;
// The first `usePwaUpdate(config)` call wins — the singleton can only register
// one service worker, so later callers inherit the first config.
let config: PwaUpdateConfig | null = null;
// Set the moment the user applies the waiting build (taps "Update" →
// `reload()`). The `controlling` listener reloads the page once the new worker
// takes over — but only when this is set OR workbox reports `isUpdate`. Workbox
// derives `isUpdate` from whether a worker was *already controlling the page at
// registration time*, which is false on the session that first installs the SW
// (and, in practice, on iOS where the controller often isn't attached to the
// load that registered it). Gating the reload on `isUpdate` alone therefore
// leaves an explicit "Update" tap sending SKIP_WAITING — the worker activates —
// but the page never reloading, so the toast just lingers. A user-initiated
// apply must always reload.
let applyingUpdate = false;
// Reload only once: messageSkipWaiting → activate → `clients.claim()` fires a
// single `controllerchange`, but guard anyway against a second source (another
// tab, a re-entrant event) double-reloading mid-navigation.
let reloaded = false;

function applyUpdate() {
  applyingUpdate = true;
  wb?.messageSkipWaiting();
}

function reloadOnce() {
  if (reloaded) return;
  reloaded = true;
  window.location.reload();
}

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<PwaUpdateState>) {
  const next = { ...state, ...patch };
  if (
    next.progress === state.progress &&
    next.needRefresh === state.needRefresh &&
    next.incomingVersion === state.incomingVersion &&
    next.checking === state.checking
  ) {
    return;
  }
  state = next;
  emit();
}

// The running bundle only knows its OWN version, the build being upgraded
// AWAY from. The incoming build's version lives in `version.json`, deployed
// alongside the new SW; fetch it cache-bypassed so the still-active old SW
// lets the request reach the network and return the freshly-deployed file.
async function fetchIncomingVersion(base: string): Promise<string | null> {
  try {
    const res = await fetch(`${base}version.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      "version" in data &&
      typeof (data as { version: unknown }).version === "string"
    ) {
      return (data as { version: string }).version;
    }
    return null;
  } catch {
    return null;
  }
}

type PrecacheManifest = {
  totalBytes: number;
  assets: Record<string, number>;
};

async function fetchPrecacheManifest(
  base: string,
): Promise<PrecacheManifest | null> {
  try {
    const res = await fetch(`${base}precache-manifest.json`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      "totalBytes" in data &&
      typeof (data as { totalBytes: unknown }).totalBytes === "number" &&
      "assets" in data &&
      typeof (data as { assets: unknown }).assets === "object"
    ) {
      return data as PrecacheManifest;
    }
    return null;
  } catch {
    return null;
  }
}

// Sum the manifest byte sizes of every precached asset already present in
// this app's precache cache. Workbox names that cache
// `<cacheId>-precache-v2-<scope>`; entries are keyed by the request URL (with a
// `?__WB_REVISION__=` query for revisioned ones), so we compare by pathname to
// ignore the query and to ignore other deploy slots' caches sharing the origin.
async function cachedBytes(
  cacheId: string,
  manifest: PrecacheManifest,
): Promise<number> {
  if (typeof caches === "undefined") return 0;
  const names = await caches.keys();
  const cacheName = names.find((n) => n.startsWith(`${cacheId}-precache`));
  if (!cacheName) return 0;
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const present = new Set<string>();
  for (const req of requests) {
    try {
      present.add(new URL(req.url).pathname);
    } catch {
      // Ignore unparseable cache keys.
    }
  }
  let bytes = 0;
  for (const [path, size] of Object.entries(manifest.assets)) {
    if (present.has(path)) bytes += size;
  }
  return bytes;
}

// While the incoming SW is in its `installing` state, poll the precache cache
// and translate "bytes cached so far" into a 0..99 fill. We cap at 99 so the
// jump to 100 coincides with the `waiting` event, the moment the build is
// genuinely ready to apply.
function trackInstall(
  installing: ServiceWorker | null,
  base: string,
  cacheId: string,
) {
  if (!installing) return;
  let stopped = false;
  let timer: number | undefined;

  const stop = () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };

  const poll = async () => {
    if (stopped) return;
    const manifest = await fetchPrecacheManifest(base);
    if (manifest && manifest.totalBytes > 0) {
      const bytes = await cachedBytes(cacheId, manifest);
      const pct = Math.min(99, Math.round((bytes / manifest.totalBytes) * 100));
      const prev = state.progress ?? 0;
      // Never walk the fill backwards (a slot's old entries can drop out
      // mid-install when caches are cleaned up).
      setState({ progress: Math.max(prev, pct) });
    }
    if (!stopped) timer = window.setTimeout(() => void poll(), POLL_MS);
  };

  // Seed the fill immediately from whatever is already cached, then poll
  // for the rest.
  setState({ progress: state.progress ?? 0 });
  void poll();

  installing.addEventListener("statechange", () => {
    if (installing.state === "installing") return;
    stop();
    // "installed" hands off to the `waiting` event (→ 100 + prompt). A first
    // install with no prior controller goes straight to "activated";
    // "redundant" means it was superseded. Either way there is no waiting
    // build to advertise, so clear the fill.
    if (installing.state === "activated" || installing.state === "redundant") {
      setState({ progress: null });
    }
  });
}

function start() {
  if (started) return;
  started = true;
  const cfg = config;
  if (!cfg) return;
  if (cfg.enabled === false) return;
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const base = cfg.base;
  const cacheId = cfg.cacheId;
  const swUrl = `${base}sw.js`;

  void import("workbox-window").then(({ Workbox }) => {
    const instance = new Workbox(swUrl, {
      scope: base,
      type: "classic",
      // Bypass the HTTP cache when checking for a new SW. Without this, a CDN's
      // default caching can serve the same bytes back to the browser's update
      // check and the new SW never gets discovered until the cached SW is >24h
      // old.
      updateViaCache: "none",
    });
    wb = instance;

    instance.addEventListener("waiting", () => {
      setState({ progress: 100, needRefresh: true });
      void fetchIncomingVersion(base).then((version) =>
        setState({ incomingVersion: version }),
      );
    });
    instance.addEventListener(
      "controlling",
      (event: { isUpdate?: boolean }) => {
        // Reload when the user applied the update (`applyingUpdate`) or when an
        // update that was controlling at registration takes over — e.g. another
        // tab applied it (`isUpdate`). NOT on a first install's `clients.claim()`
        // (no prior controller, no user apply): there is nothing to reload to.
        if (applyingUpdate || event.isUpdate) reloadOnce();
      },
    );

    instance
      .register()
      .then((registration) => {
        if (!registration) return;
        // Keep the registration so a manual `checkForUpdate()` can drive
        // `reg.update()` on demand and inspect the result.
        reg = registration;
        if (registration.installing)
          trackInstall(registration.installing, base, cacheId);
        registration.addEventListener("updatefound", () =>
          // A new worker may already be mid-install when we register (another
          // tab kicked it off); track it so the fill picks up.
          trackInstall(registration.installing, base, cacheId),
        );

        void registration.update();
        window.setInterval(() => {
          if (document.visibilityState === "visible")
            void registration.update();
        }, HOUR_MS);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible")
            void registration.update();
        });
      })
      .catch(() => {
        // Registration errors are swallowed — the app still functions
        // without a service worker.
      });
  });
}

// Probe the network for a newer service worker right now, rather than waiting
// for the hourly / visibility-change check. Drives a "check for updates"
// control; resolves with what it found.
async function runCheck(base: string): Promise<PwaUpdateCheckResult> {
  // A build is already installed and parked. The prompt may have been
  // dismissed — re-surface it and report the find without touching the network.
  if (state.needRefresh) return "update-found";
  const registration = reg;
  // No service worker to ask: a dev build (`enabled: false`), a browser
  // without service-worker support, or a registration that failed.
  if (!registration) return "unavailable";

  setState({ checking: true });
  try {
    await registration.update();
  } catch {
    return "unavailable";
  } finally {
    setState({ checking: false });
  }

  // A worker is sitting in `waiting` — typically an earlier auto-check found it
  // but its prompt was dismissed. Re-raise the prompt (the `waiting` event only
  // fires on first discovery, so do it by hand) and fetch its version.
  if (registration.waiting) {
    setState({ needRefresh: true, progress: 100 });
    void fetchIncomingVersion(base).then((version) =>
      setState({ incomingVersion: version }),
    );
    return "update-found";
  }
  // A new build is downloading; `trackInstall` is already following it and the
  // `waiting` event will raise the prompt once it is ready to apply.
  if (registration.installing) return "update-found";
  // The running build is the newest the server has.
  return "up-to-date";
}

function checkForUpdate(base: string): Promise<PwaUpdateCheckResult> {
  checkInFlight ??= runCheck(base).finally(() => {
    checkInFlight = null;
  });
  return checkInFlight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

function getSnapshot(): PwaUpdateState {
  return state;
}

const SERVER_SNAPSHOT: PwaUpdateState = {
  progress: null,
  needRefresh: false,
  incomingVersion: null,
  checking: false,
};

function getServerSnapshot(): PwaUpdateState {
  return SERVER_SNAPSHOT;
}

export type PwaUpdate = PwaUpdateState & {
  // Apply the waiting build: posts SKIP_WAITING to it; the `controlling`
  // listener reloads the page once it takes over.
  reload: () => void;
  // Hide the prompt and clear the fill until a fresher build arrives.
  dismiss: () => void;
  // Probe for a newer build now instead of waiting for the hourly check. Sets
  // `checking` while it runs and resolves with the outcome; on a find the
  // prompt surfaces through `needRefresh` as usual. Drives a "check for
  // updates" control (see `CheckForUpdatesItem`).
  checkForUpdate: () => Promise<PwaUpdateCheckResult>;
};

export function usePwaUpdate(updateConfig: PwaUpdateConfig): PwaUpdate {
  // First config wins (the singleton registers a single SW). Assigning an
  // idempotent value on re-render is safe and avoids an effect just to seed it.
  config ??= updateConfig;
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    ...snapshot,
    reload: applyUpdate,
    dismiss: () => setState({ needRefresh: false, progress: null }),
    checkForUpdate: () => checkForUpdate(config?.base ?? updateConfig.base),
  };
}
