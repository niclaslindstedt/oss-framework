// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// On-demand loading for the non-default webfont families.
//
// The framework knows *when* a family is needed — the theme engine asks for
// one when the user picks it, and the Appearance font picker asks for all of
// them to render its previews in their real faces. It deliberately does not
// know *where the bytes come from*: the app registers a loader per family and
// owns the font packages, the subsets, and the licence.
//
// That split is not fussiness. A loader written here would put a bare
// `@fontsource/…` specifier in the published bundle, and a bundler resolves
// every specifier in a module graph before it shakes anything out of it — so
// an app that only wanted a `Button` would fail to build unless it installed
// font packages it never asked for. Registration keeps the published output
// free of specifiers the framework cannot promise are installed.
//
// The batteries are still included, opt in with one import:
//
//   import "@niclaslindstedt/oss-framework/theme/fontsource";
//
// …which registers the three families this framework's own presets name,
// latin + latin-ext subsets only, from the `@fontsource/*` packages (declared
// there as optional peer dependencies). Bring your own loaders instead — a
// self-hosted set, a different family, a subset of your choosing — by calling
// {@link registerFontLoaders} yourself.
//
// With nothing registered, every non-default family resolves to a no-op: the
// UI keeps the statically-bundled default face rather than failing.

import type { FontFamilyId } from "./presets.ts";

/** The families that load on demand — every one but the bundled default. */
export type NonDefaultFamily = Exclude<FontFamilyId, "mono">;

/**
 * A family's loader: whatever it takes to get the `@font-face` rules onto the
 * page, as a promise that settles when they are there. Usually a dynamic
 * `import()` of a CSS file, which is why the return type is deliberately
 * `unknown` — the framework never looks at what resolves.
 */
export type FontLoader = () => Promise<unknown>;

/** Loaders by family. Any subset; an unregistered family simply never loads. */
export type FontLoaders = Partial<Record<NonDefaultFamily, FontLoader>>;

const registered: FontLoaders = {};

/**
 * Tell the framework how to fetch a family's `@font-face` rules. Call it once,
 * before first paint; later calls merge, so a family can be replaced and a
 * fourth added without disturbing the rest.
 */
export function registerFontLoaders(loaders: FontLoaders): void {
  Object.assign(registered, loaders);
}

/** Which families currently have a loader — what a picker can honestly offer. */
export function loadableFontFamilies(): NonDefaultFamily[] {
  return Object.keys(registered) as NonDefaultFamily[];
}

// Memoise so each family's loader runs at most once per session.
const started = new Map<FontFamilyId, Promise<unknown>>();

/**
 * Ensure the `@font-face` rules for `id` are present. Resolves immediately for
 * the statically-bundled default family, and for any family with no registered
 * loader — a missing font is not a reason to fail a theme change.
 */
export function loadFontFamily(id: FontFamilyId): Promise<unknown> {
  if (id === "mono") return Promise.resolve();
  const existing = started.get(id);
  if (existing) return existing;
  const loader = registered[id];
  if (!loader) return Promise.resolve();
  const p = loader();
  started.set(id, p);
  return p;
}

/**
 * Kick off every registered family so font-picker previews render in their
 * real face. Fire-and-forget — previews swap in as each lands.
 */
export function loadAllFontFamilies(): void {
  for (const id of loadableFontFamilies()) void loadFontFamily(id);
}
