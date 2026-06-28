// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { statSync, readdirSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from "vite";

import { cacheIdForBase } from "./src/app/pwa.ts";

// Hand-rolls the demo's real service worker at build time so the deployed
// preview is an installable, self-updating PWA — the thing the framework's
// `pwa` module exists to drive. We deliberately avoid `vite-plugin-pwa` /
// Workbox: the demo's whole point is to dogfood the framework with the minimum
// surface, and the framework's `usePwaUpdate` hook only needs three files and
// one cache-naming convention, which is cheaper to emit by hand than to pull a
// Workbox toolchain (and its Vite-version coupling) in for.
//
// What the hook (src/pwa/usePwaUpdate.ts) expects, and what we therefore emit:
//   - `${base}sw.js`                  a "prompt to update" worker (installs,
//                                     parks in `waiting`, never auto-skips)
//   - `${base}version.json`           `{ version }` shown in the toast
//   - `${base}precache-manifest.json` `{ totalBytes, assets }` driving the fill
//   - a Cache Storage entry named `<cacheId>-precache`
//
// The SW changes bytes every deploy (it embeds the build version and the
// content-hashed asset list), so the browser's update check reliably discovers
// it and the new worker reaches `waiting` → the framework raises the prompt.
//
// THREE SLOTS, ONE ORIGIN. The demo deploys to `/` (release), `/preview/`
// (main), and `/branch/` (a parked branch) on a single origin. Each slot gets
// its own worker (scoped to its base) and its own precache id, so the preview
// and a branch update independently of the release. The pitfall — the one
// that's "always missed" — is that the RELEASE worker's scope is `/`, which
// also covers `/preview/` and `/branch/`: if a visitor lands on `/` first, its
// worker becomes the controller for the whole origin, and a later navigation to
// `/preview/` (before that slot's own worker activates) would be answered with
// the RELEASE app shell. So each worker carries a navigation denylist of the
// sibling slots nested under its scope and refuses to answer their navigations,
// letting them reach the network and boot their own shell + worker.

// The deploy slots `pages.yml` serves, in priority order. Mirror that file: a
// worker ignores navigations for any of these nested under its own base.
export const DEPLOY_SLOTS = ["/", "/preview/", "/branch/"];

type DemoPwaOptions = {
  // The bundler base (`/`, `/preview/`, `/branch/`). Drives the SW scope, the
  // emitted file URLs, and — via `cacheIdForBase` — the precache name.
  base: string;
  // Label shown in the "a new version is ready" toast (a short commit sha or a
  // build timestamp). Embedding it in the SW also guarantees the worker's bytes
  // differ between deploys even when no asset hash changed.
  version: string;
  // All deploy-slot bases sharing this origin. The worker refuses to answer a
  // navigation for any slot nested under its own base (see above). Defaults to
  // `DEPLOY_SLOTS`.
  slots?: string[];
};

// Public assets we never want in the precache: the custom-domain marker (it is
// not a real asset) and source maps (dead weight offline).
const PUBLIC_SKIP = new Set(["CNAME"]);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function buildServiceWorker(
  cacheId: string,
  base: string,
  version: string,
  precache: string[],
  denylist: string[],
): string {
  const cacheName = `${cacheId}-precache`;
  return `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// GENERATED — do not edit. Emitted by demo/pwa-plugin.ts for the OSS Framework
// demo PWA. A minimal "prompt to update" precaching worker: it installs the
// build's assets, parks in \`waiting\` (never auto-skipWaiting — a silent swap
// would discard an in-progress edit), and applies on a SKIP_WAITING message
// from the framework's update toast. Build: ${version}
const CACHE = ${JSON.stringify(cacheName)};
const BASE = ${JSON.stringify(base)};
const INDEX = ${JSON.stringify(`${base}index.html`)};
const PRECACHE = ${JSON.stringify(precache)};
const PRECACHE_PATHS = new Set(
  PRECACHE.map((u) => new URL(u, self.location.href).pathname),
);
// Sibling deploy slots nested under this worker's scope (e.g. \`/preview/\`,
// \`/branch/\` for the \`/\` release worker). Navigations into them are NOT ours.
const DENY = ${JSON.stringify(denylist)};

self.addEventListener("install", (event) => {
  // Populate the precache one entry at a time so the window-side progress
  // poller (usePwaUpdate) watches the fill advance as bytes land. No
  // skipWaiting: park in \`waiting\` until the user accepts the prompt.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const url of PRECACHE) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch {
          // A single asset failing to cache must not abort the whole install.
        }
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Drop precache entries from older builds that are no longer wanted.
      for (const req of await cache.keys()) {
        if (!PRECACHE_PATHS.has(new URL(req.url).pathname)) {
          await cache.delete(req);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-shell navigations: serve the cached index for any in-scope route so the
  // installed PWA opens offline, falling back to the network then the shell.
  if (req.mode === "navigate") {
    // A sibling slot nested under our scope (the release worker's scope "/"
    // also covers /preview/ and /branch/): never answer it, or this slot's
    // shell would shadow the other app. Let it reach the network so that slot
    // boots its own shell and registers its own worker.
    if (DENY.some((p) => url.pathname.startsWith(p))) return;
    // Only our own routes get the shell fallback. (Belt-and-braces: the scope
    // already bounds us, but a future broader scope shouldn't leak.)
    if (!url.pathname.startsWith(BASE)) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match(INDEX)) ||
          fetch(req).catch(() => cache.match(INDEX))
        );
      })(),
    );
    return;
  }

  // Precached assets: cache-first (they are content-hashed, so safe to pin).
  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) || fetch(req);
      })(),
    );
  }
});
`;
}

export function demoPwa({
  base,
  version,
  slots = DEPLOY_SLOTS,
}: DemoPwaOptions): Plugin {
  const cacheId = cacheIdForBase(base);
  // Sibling slots that fall inside our scope — i.e. nested under `base` but not
  // `base` itself. For `/` this is `/preview/` + `/branch/`; for either of
  // those it's empty (their scope already excludes the others).
  const denylist = slots.filter((s) => s !== base && s.startsWith(base));
  let config: ResolvedConfig;

  return {
    name: "demo-pwa",
    apply: "build",
    // Run after Vite's own build plugins so the generated `index.html` is
    // already in the bundle when we collect assets for the precache.
    enforce: "post",

    configResolved(resolved) {
      config = resolved;
    },

    // Wire the manifest, theme color, and apple-touch metadata into the shell.
    // Done here (not in index.html) so every slot gets base-correct hrefs from
    // the single source of truth without hand-editing per slot.
    transformIndexHtml(): HtmlTagDescriptor[] {
      return [
        {
          tag: "link",
          attrs: { rel: "manifest", href: `${base}manifest.webmanifest` },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: { rel: "icon", href: `${base}icons/icon.svg` },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: `${base}icons/apple-touch-icon-180.png`,
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "theme-color", content: "#0b0d10" },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "apple-mobile-web-app-capable", content: "yes" },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: {
            name: "apple-mobile-web-app-status-bar-style",
            content: "black-translucent",
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "apple-mobile-web-app-title", content: "OSS Demo" },
          injectTo: "head",
        },
      ];
    },

    // After the bundle is built, collect every emitted asset plus the public
    // assets and emit the worker + the two manifests the hook reads.
    generateBundle(_options, bundle) {
      const assets: Record<string, number> = {};

      const add = (urlPath: string, bytes: number) => {
        assets[urlPath] = bytes;
      };

      // Hashed build output (JS, CSS, the HTML shell, any emitted assets).
      for (const [fileName, output] of Object.entries(bundle)) {
        const bytes =
          output.type === "chunk"
            ? Buffer.byteLength(output.code)
            : typeof output.source === "string"
              ? Buffer.byteLength(output.source)
              : output.source.byteLength;
        add(`${base}${fileName}`, bytes);
      }

      // Public assets (icons, the web manifest) — copied verbatim by Vite, so
      // they are not in `bundle`; read their sizes off disk. Skip source maps
      // and the CNAME marker.
      const publicDir = config.publicDir;
      if (publicDir) {
        for (const file of listFiles(publicDir)) {
          const rel = relative(publicDir, file).split(sep).join(posix.sep);
          if (PUBLIC_SKIP.has(rel) || rel.endsWith(".map")) continue;
          add(`${base}${rel}`, statSync(file).size);
        }
      }

      const precache = Object.keys(assets);
      const totalBytes = Object.values(assets).reduce((a, b) => a + b, 0);

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: buildServiceWorker(cacheId, base, version, precache, denylist),
      });
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ version }, null, 2)}\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.json",
        source: `${JSON.stringify({ totalBytes, assets }, null, 2)}\n`,
      });
    },
  };
}
