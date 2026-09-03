// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Measure what one import costs, and fail when it costs more than it should.
//
// Run after `npm run build` (CI does; `npm run size` does it for you locally).
// Each case in `budgets.mjs` is bundled as its own entry with esbuild —
// minified ESM, `react` / `react-dom` external, exactly the shape a consuming
// app's bundler produces.
//
// Two things are being checked, and only one of them is a number:
//
//   - **the budget** — one import pulls its symbol and nothing else;
//   - **resolvability** — the bundle builds with *only* `react` external. The
//     library must never ship a bare specifier for a package it cannot promise
//     is installed: a bundler resolves every specifier in a graph before it
//     shakes anything out of it, so one stray optional-peer import makes an app
//     that wanted a `Button` fail to build. (This is why the `@fontsource/*`
//     loaders live behind the opt-in `./theme/fontsource` entry.) A resolve
//     error fails the run with the specifier named.
//
// The measurement runs against the *published* package: a temporary directory
// with `node_modules/@niclaslindstedt/oss-framework` symlinked to the repo, so
// `exports`, `sideEffects` and the dist layout are all exercised as a consumer
// would exercise them — not as a path import that bypasses them.

import { build } from "esbuild";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CASES } from "./budgets.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

if (!existsSync(join(root, "dist", "index.js"))) {
  console.error("size: dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

// A throwaway consumer package. Resolving through a real `node_modules` is the
// whole point: it is what makes the `exports` map and `sideEffects` count.
const consumer = mkdtempSync(join(tmpdir(), "oss-size-"));
try {
  const modules = join(consumer, "node_modules");
  mkdirSync(join(modules, "@niclaslindstedt"), { recursive: true });
  symlinkSync(root, join(modules, "@niclaslindstedt", "oss-framework"), "dir");
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "oss-size-probe", private: true, type: "module" }),
  );

  const results = [];
  for (const testCase of CASES) {
    const entry = join(
      consumer,
      `${testCase.name.replace(/\W+/g, "-")}.${testCase.cjs ? "cjs" : "js"}`,
    );
    writeFileSync(entry, testCase.code);
    let bytes;
    try {
      const out = await build({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        format: testCase.cjs ? "cjs" : "esm",
        platform: testCase.cjs ? "node" : "browser",
        // Only the renderer. Anything else the library reaches for has to be
        // resolvable, or it is a specifier a consumer would trip over too.
        external: ["react", "react-dom"],
        write: false,
        absWorkingDir: consumer,
        logLevel: "silent",
      });
      bytes = out.outputFiles[0].contents.byteLength;
    } catch (err) {
      console.error(`\n✗ ${testCase.name} — could not be bundled:\n`);
      for (const e of err.errors ?? []) {
        console.error(`  ${e.text}`);
        if (e.location)
          console.error(`    at ${e.location.file}:${e.location.line}`);
      }
      console.error(
        `\n  A bare specifier the library ships must resolve for every consumer.\n` +
          `  Move it behind an opt-in entry (see ./theme/fontsource) or drop it.\n`,
      );
      process.exit(1);
    }
    results.push({ ...testCase, bytes });
  }

  const width = Math.max(...results.map((r) => r.name.length));
  let failed = 0;
  for (const r of results) {
    const over = r.bytes > r.budget;
    if (over) failed += 1;
    const pct = Math.round((r.bytes / r.budget) * 100);
    console.log(
      `${over ? "✗" : "✓"} ${r.name.padEnd(width)}  ${String(r.bytes).padStart(6)} B` +
        `  / ${String(r.budget).padStart(6)} B  (${String(pct).padStart(3)}%)`,
    );
  }

  if (failed > 0) {
    console.error(
      `\nsize: ${failed} import${failed === 1 ? "" : "s"} over budget.\n` +
        `  Either the import started pulling something it shouldn't — check for a\n` +
        `  new side effect, a barrel imported for effect, or a module that grew a\n` +
        `  dependency on a heavier neighbour — or the growth is real and earned,\n` +
        `  in which case raise the number in scripts/size/budgets.mjs and say why.\n`,
    );
    process.exit(1);
  }
  console.log(`\nsize: ${results.length} imports within budget.`);

  // The stylesheet is the one part of the package a bundler cannot shake, so
  // it is checked by a different question: does the split path actually save
  // anything? An app that offers two themes should pay for two, not thirteen.
  const bytes = (p) => statSync(join(root, "dist", p)).size;
  const themeDir = join(root, "dist", "styles", "theme");
  const themes = readdirSync(themeDir).filter((f) => f.endsWith(".css"));
  const everything = bytes("styles.css");
  const twoThemes =
    bytes(join("styles", "base.css")) +
    bytes(join("styles", "theme", themes[0])) +
    bytes(join("styles", "theme", themes[1]));

  console.log(
    `\ncss: styles.css ${everything} B (${themes.length} themes) · ` +
      `base + 2 themes ${twoThemes} B ` +
      `(${Math.round((1 - twoThemes / everything) * 100)}% less)`,
  );

  if (twoThemes >= everything) {
    console.error(
      `\ncss: the split stylesheets are no smaller than the everything bundle.\n` +
        `  Either a theme block stopped being split out of styles/base.css, or\n` +
        `  base.css picked up colours it should not carry — check\n` +
        `  scripts/build-styles.mjs.\n`,
    );
    process.exit(1);
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
