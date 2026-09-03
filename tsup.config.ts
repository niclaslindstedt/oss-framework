import { readdirSync } from "node:fs";

import { defineConfig } from "tsup";

// Library build. Each entry becomes its own subpath export (see the
// `exports` map in package.json) so consumers can `import { useEscapeKey }
// from "@niclaslindstedt/oss-framework"` or pull a narrower slice from
// `.../hooks` and let their bundler tree-shake the rest.
//
// Tree-shaking already makes the barrels cost nothing they shouldn't (the
// `size` target measures it). The per-file entries below are for the consumers
// that get no tree-shaking at all: a `require()` of a barrel pulls every
// module in it, and a browser loading the package over an import map fetches
// whole files rather than symbols. Those consumers can reach one component or
// one hook directly — `.../components/Button`, `.../hooks/useEscapeKey` —
// which the `./components/*` and `./hooks/*` wildcard exports resolve.
//
// The list is globbed rather than written out: a new component is a new
// subpath the moment it lands, with nothing to remember to update, and no way
// for the two lists to drift apart.
function moduleEntries(dir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(`src/${dir}`)
      .filter(
        (f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts") && f !== "index.ts",
      )
      .map((f) => [`${dir}/${f.replace(/\.tsx?$/, "")}`, `src/${dir}/${f}`]),
  );
}

export default defineConfig({
  entry: {
    ...moduleEntries("components"),
    ...moduleEntries("hooks"),
    index: "src/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "theme/index": "src/theme/index.ts",
    "theme/fontsource": "src/theme/fontsource.ts",
    "changelog/index": "src/changelog/index.ts",
    "storage/index": "src/storage/index.ts",
    "logging/index": "src/logging/index.ts",
    "sidebar/index": "src/sidebar/index.ts",
    "components/index": "src/components/index.ts",
    "checklist/index": "src/checklist/index.ts",
    "glyphs/index": "src/glyphs/index.ts",
    "pwa/index": "src/pwa/index.ts",
    "achievements/index": "src/achievements/index.ts",
    "encryption/index": "src/encryption/index.ts",
    "i18n/index": "src/i18n/index.ts",
    "namespaces/index": "src/namespaces/index.ts",
    "sync/index": "src/sync/index.ts",
    "search/index": "src/search/index.ts",
    "markdown/index": "src/markdown/index.ts",
    "charts/index": "src/charts/index.ts",
    "zip/index": "src/zip/index.ts",
    "calendar/index": "src/calendar/index.ts",
    "files/index": "src/files/index.ts",
    "format/index": "src/format/index.ts",
    "viewer/index": "src/viewer/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // React is provided by the host app — never bundle a second copy. The
  // theme font loaders dynamically import `@fontsource/*` CSS; those
  // specifiers pass through untouched so the consuming app's bundler resolves
  // and ships the font bytes from its own node_modules (optional peer deps).
  // `workbox-window` is the same shape: the PWA update hook lazily imports it,
  // and the consuming app (which owns the service-worker build) supplies it.
  external: ["react", "react-dom", /^@fontsource\//, "workbox-window"],
  // After the JS/d.ts build, assemble the shipped stylesheet: the static
  // `framework.css` plus the per-preset colour blocks generated from
  // `PRESET_PALETTES` (the compiled module is needed, hence onSuccess). See
  // scripts/build-styles.mjs.
  onSuccess: "node scripts/build-styles.mjs",
});
