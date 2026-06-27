#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Rank what the donor app (`budget`) has that the framework does NOT yet ship.
// The framework already carries everything mined from the earlier source apps,
// so the useful question is no longer "which file is duplicated across apps" —
// it is "which of the donor's files has no counterpart in the framework's own
// `src/` yet?". Those are the next things to extract.
//
// For each `.ts`/`.tsx` file under the donor app's `src/`, the script measures
// how much of it the framework already carries: the best line-multiset
// similarity to any framework `src/` file ("coverage"). A file the framework
// already ships — same basename, or a near-duplicate above the coverage
// threshold — is dropped as done. What remains is the candidate list: donor
// surface with little or no framework equivalent, ranked so the highest-leverage
// (largest, least-covered) net-new files come first.
//
// Run `clone-apps.mjs` first so the donor app is on disk. Then:
//
//   node similarity.mjs                 # markdown report to stdout
//   node similarity.mjs --json          # machine-readable JSON
//   node similarity.mjs --max 40        # only candidates <= 40% covered
//   APP=budget node similarity.mjs      # pick the donor app (default budget)
//   COVERED_AT=80 node similarity.mjs   # coverage % at/above which a file is "shipped"
//   REFERENCE_DIR=.reference node similarity.mjs
//
// Coverage is a line-multiset Jaccard ratio (order-independent, fast,
// dependency-free): |lines(A) ∩ lines(B)| / |lines(A) ∪ lines(B)|, counting
// duplicates, blank lines ignored. It is a *ranking* heuristic, not a diff —
// low coverage means "the framework has little like this", a strong signal the
// file is net-new. Always read the real file before extracting.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const referenceDir = resolve(process.env.REFERENCE_DIR ?? ".reference");
const app = (process.env.APP ?? "budget").trim();
const asJson = process.argv.includes("--json");
const maxIdx = process.argv.indexOf("--max");
const maxCoverage = maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) : 100;
// At/above this coverage %, a donor file is treated as already shipped by the
// framework (possibly under a different basename) and dropped from candidates.
const coveredAt = Number(process.env.COVERED_AT ?? 80);

const LARGE_FILE_LIMIT = 1000; // OSS_SPEC §20.5 size smell.

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function nonBlankLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// Jaccard over line multisets.
function similarity(aLines, bLines) {
  const count = (lines) => {
    const m = new Map();
    for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const a = count(aLines);
  const b = count(bLines);
  let inter = 0;
  for (const [line, n] of a) inter += Math.min(n, b.get(line) ?? 0);
  const union = aLines.length + bLines.length - inter;
  return union === 0 ? 1 : inter / union;
}

// The framework's own surface — the baseline the donor is measured against.
const frameworkSrc = resolve("src");
if (!existsSync(frameworkSrc)) {
  console.error(
    `error: ${frameworkSrc} not found — run from the framework root.`,
  );
  process.exit(1);
}
const frameworkFiles = walk(frameworkSrc);
const frameworkBasenames = new Set(frameworkFiles.map((f) => basename(f)));
const frameworkLineSets = frameworkFiles.map((f) => ({
  path: relative(frameworkSrc, f),
  lines: nonBlankLines(f),
}));

// The donor app's surface.
const appRoot = join(referenceDir, app);
const appSrc = join(appRoot, "src");
if (!existsSync(appSrc)) {
  console.error(
    `error: ${appSrc} not found. Run clone-apps.mjs first ` +
      `(the mirror may still be empty — there is nothing to mine until it has content).`,
  );
  process.exit(1);
}

const rows = walk(appSrc).map((file) => {
  const key = relative(appSrc, file);
  const lines = nonBlankLines(file);
  // Best similarity to anything the framework already ships.
  let best = 0;
  let closest = null;
  for (const fw of frameworkLineSets) {
    const s = similarity(lines, fw.lines);
    if (s > best) {
      best = s;
      closest = fw.path;
    }
  }
  const rawLines = readFileSync(file, "utf8").split("\n").length;
  const shippedByName = frameworkBasenames.has(basename(file));
  return {
    path: key,
    module: key.split("/")[0],
    coverage: Math.round(best * 100),
    closest,
    shippedByName,
    // Already shipped if the framework has the same basename, or a near-duplicate.
    done: shippedByName || best * 100 >= coveredAt,
    lines: rawLines,
    large: rawLines > LARGE_FILE_LIMIT,
  };
});

// Candidates: donor files the framework does not yet ship. Highest leverage
// first — least covered, then largest.
const candidates = rows
  .filter((r) => !r.done && r.coverage <= maxCoverage)
  .sort((a, b) => a.coverage - b.coverage || b.lines - a.lines);

// Per-module rollup: where does the net-new surface cluster?
const byModule = new Map();
for (const r of candidates) {
  const m = byModule.get(r.module) ?? { count: 0, sum: 0 };
  m.count++;
  m.sum += r.coverage;
  byModule.set(r.module, m);
}
const modules = [...byModule.entries()]
  .map(([module, { count, sum }]) => ({
    module,
    files: count,
    avgCoverage: Math.round(sum / count),
  }))
  .sort((a, b) => b.files - a.files || a.avgCoverage - b.avgCoverage);

if (asJson) {
  console.log(JSON.stringify({ app, candidates, modules }, null, 2));
} else {
  const pct = (n) => `${n}%`;
  console.log(`# Extraction candidates — ${app} → framework\n`);
  console.log(`Donor app: ${app}   Baseline: framework src/`);
  console.log(
    `Candidates (not yet in the framework): ${candidates.length}` +
      `${maxCoverage < 100 ? ` (showing ≤ ${maxCoverage}% covered)` : ""}\n`,
  );
  console.log(`## By module (where the net-new surface clusters)\n`);
  console.log(`| Module | Candidate files | Avg coverage |`);
  console.log(`|--------|----------------:|-------------:|`);
  for (const m of modules) {
    console.log(`| ${m.module} | ${m.files} | ${pct(m.avgCoverage)} |`);
  }
  console.log(`\n## By file (extract least-covered, highest-leverage first)\n`);
  console.log(`| Coverage | Lines | File | Closest framework file |`);
  console.log(`|---------:|------:|------|------------------------|`);
  for (const r of candidates) {
    const flag = r.large ? " ⚠️>1000" : "";
    const closest = r.coverage > 0 && r.closest ? r.closest : "—";
    console.log(
      `| ${pct(r.coverage)} | ${r.lines}${flag} | ${r.path} | ${closest} |`,
    );
  }
  console.log(
    `\nCoverage = best line-similarity to any framework src/ file: low = net-new.` +
      ` ⚠️ marks files over the OSS_SPEC §20.5 1000-line limit — split as part of extraction.`,
  );
}
