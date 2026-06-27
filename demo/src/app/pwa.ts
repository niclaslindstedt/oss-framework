// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared PWA wiring for the demo. The framework owns the update *state machine*
// (`usePwaUpdate`) and the prompt UI; the app owns the service-worker *build*.
// The one value both sides must agree on is the precache cache id — the SW
// build names its cache `<cacheId>-precache` and the hook reads progress from a
// cache matching that prefix. So this helper is imported by BOTH `App.tsx`
// (browser) and `vite.config.ts` (the SW-emitting build plugin); keep it free
// of any browser- or Node-only imports.
//
// The demo deploys to three GitHub Pages slots on one origin (`/`, `/preview/`,
// `/branch/`). Service-worker scope keeps each slot's worker to its own path,
// but their precaches share Cache Storage, so each slot needs a DISTINCT cache
// id or they would clobber each other. Deriving it from the base path gives
// every slot its own: `oss-demo`, `oss-demo-preview`, `oss-demo-branch`.

/** Per-deploy-slot precache cache id, derived from the bundler `base`. */
export function cacheIdForBase(base: string): string {
  const slug = base.replace(/^\/+|\/+$/g, "").replace(/\W+/g, "-");
  return slug ? `oss-demo-${slug}` : "oss-demo";
}
