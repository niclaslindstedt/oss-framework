import process from "node:process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The GitHub Pages base path is injected by the `pages.yml` workflow via
// VITE_BASE so the same bundle works at `/` (release), `/preview/` (main), or
// `/branch/` (a dispatched feature branch). Defaults to `/` for local dev.
const base = process.env.VITE_BASE ?? "/";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    // Resolve the framework against its TypeScript source (not the built
    // `dist/`) so the preview always reflects the current commit — the whole
    // point of the per-commit deploy. Subpaths are listed before the bare
    // package so the more specific match wins.
    alias: [
      {
        find: "@niclaslindstedt/oss-framework/hooks",
        replacement: here("../src/hooks/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/theme",
        replacement: here("../src/theme/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/changelog",
        replacement: here("../src/changelog/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/storage",
        replacement: here("../src/storage/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/sidebar",
        replacement: here("../src/sidebar/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/components",
        replacement: here("../src/components/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/checklist",
        replacement: here("../src/checklist/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework",
        replacement: here("../src/index.ts"),
      },
      // The theme font loaders dynamically import optional `@fontsource/*` CSS
      // that isn't installed here; stub every such specifier so a build that
      // pulls the theme graph still resolves (mirrors `vitest.config.ts`).
      {
        find: /^@fontsource\/.+/,
        replacement: here("../tests/stubs/fontsource.ts"),
      },
    ],
  },
  build: {
    // Emit to a repo-root `site/` the `pages.yml` workflow assembles its slots
    // from. Kept out of the library's `dist/` so a local `make build` and a
    // demo build never clobber each other.
    outDir: here("../site"),
    emptyOutDir: true,
  },
});
