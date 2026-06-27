import { defineConfig } from "tsup";

// Library build. Each entry becomes its own subpath export (see the
// `exports` map in package.json) so consumers can `import { useEscapeKey }
// from "@niclaslindstedt/oss-framework"` or pull a narrower slice from
// `.../hooks` and let their bundler tree-shake the rest.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "theme/index": "src/theme/index.ts",
    "changelog/index": "src/changelog/index.ts",
    "storage/index": "src/storage/index.ts",
    "logging/index": "src/logging/index.ts",
    "sidebar/index": "src/sidebar/index.ts",
    "components/index": "src/components/index.ts",
    "checklist/index": "src/checklist/index.ts",
    "glyphs/index": "src/glyphs/index.ts",
    "pwa/index": "src/pwa/index.ts",
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
});
