import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { demoPwa } from "./pwa-plugin.ts";

// The GitHub Pages base path is injected by the `pages.yml` workflow via
// VITE_BASE so the same bundle works at `/` (release), `/preview/` (main), or
// `/branch/` (a dispatched feature branch). Defaults to `/` for local dev.
const base = process.env.VITE_BASE ?? "/";

// The label the PWA update toast shows for the incoming build. Prefer the
// deploying commit (the workflow exposes GITHUB_SHA); fall back to a build
// timestamp for a local `build:demo`. It also lands in the generated `sw.js`,
// so the worker's bytes change every deploy and the browser reliably discovers
// the update.
const version = process.env.GITHUB_SHA
  ? process.env.GITHUB_SHA.slice(0, 7)
  : new Date().toISOString();

// Build identity for the Developer tab's "Build" grid. The commit hash is the
// deploying SHA in CI (the workflow exposes GITHUB_SHA), falling back to the
// local working tree's HEAD so a `make`/`npm run build:demo` still stamps a
// real hash; "unknown" only if git isn't reachable. The build number is the
// CI run number when present, "dev" for a local build.
const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "unknown";
    }
  })();
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? "dev";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The framework package's released version (e.g. "0.2.0"), surfaced in the
// About dropdown as the "Source code" row's subtitle. Read from the library's
// own `package.json` so it tracks every release without a second edit.
const appVersion = (
  JSON.parse(readFileSync(here("../package.json"), "utf8")) as {
    version: string;
  }
).version;

export default defineConfig({
  base,
  // Inline the package version + build identity at build time so the side menu
  // and the Developer tab can show them without importing `package.json` or
  // shelling out to git from the bundle.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // `demoPwa` only applies on build, so dev keeps registering no worker (the
  // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
  plugins: [react(), tailwindcss(), demoPwa({ base, version })],
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
        find: "@niclaslindstedt/oss-framework/logging",
        replacement: here("../src/logging/index.ts"),
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
        find: "@niclaslindstedt/oss-framework/glyphs",
        replacement: here("../src/glyphs/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/pwa",
        replacement: here("../src/pwa/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/achievements",
        replacement: here("../src/achievements/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/encryption",
        replacement: here("../src/encryption/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/i18n",
        replacement: here("../src/i18n/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/namespaces",
        replacement: here("../src/namespaces/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/sync",
        replacement: here("../src/sync/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/search",
        replacement: here("../src/search/index.ts"),
      },
      {
        find: "@niclaslindstedt/oss-framework/markdown",
        replacement: here("../src/markdown/index.ts"),
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
