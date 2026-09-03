// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The batteries for `fonts.ts`: loaders for the three non-default families the
// framework's presets name, served from the `@fontsource/*` packages.
//
// This module is **side-effecting and opt-in**. Import it once, near your entry
// module, and the framework's font picker starts offering real faces:
//
//   import "@niclaslindstedt/oss-framework/theme/fontsource";
//
// It lives behind its own subpath precisely so the bare `@fontsource/…`
// specifiers below appear in *no other* entry point: a bundler resolves every
// specifier in a graph before shaking it, so an app that imports a `Button`
// from the package root must not be made to resolve font packages it never
// installed. Importing this module is the app saying it did install them.
//
// The packages are optional peer dependencies. Install the families you want:
//
//   npm i @fontsource/inter @fontsource/source-serif-4 @fontsource/opendyslexic
//
// Only the latin + latin-ext subsets are pulled: the framework's UI text lives
// entirely within them, so fontsource's bare `400.css` / `700.css` entrypoints
// — which also carry cyrillic / greek / vietnamese — would be pure waste.
// OpenDyslexic is latin-only upstream, so it has no latin-ext import.
//
// Local-first: every byte is bundled and served from the app's own origin, with
// no CDN at runtime. To ship a different family, a different subset, or a
// self-hosted set, skip this module and call `registerFontLoaders` yourself.

import { registerFontLoaders } from "./fonts.ts";

registerFontLoaders({
  sans: () =>
    Promise.all([
      import("@fontsource/inter/latin-400.css"),
      import("@fontsource/inter/latin-ext-400.css"),
      import("@fontsource/inter/latin-700.css"),
      import("@fontsource/inter/latin-ext-700.css"),
    ]),
  serif: () =>
    Promise.all([
      import("@fontsource/source-serif-4/latin-400.css"),
      import("@fontsource/source-serif-4/latin-ext-400.css"),
      import("@fontsource/source-serif-4/latin-700.css"),
      import("@fontsource/source-serif-4/latin-ext-700.css"),
    ]),
  dyslexic: () =>
    Promise.all([
      import("@fontsource/opendyslexic/latin-400.css"),
      import("@fontsource/opendyslexic/latin-700.css"),
    ]),
});
