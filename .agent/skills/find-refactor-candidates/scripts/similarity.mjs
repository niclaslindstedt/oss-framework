#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Rank refactoring candidates by how similar the same file is across the
// source apps. Files that share a path AND most of their lines are the
// cheapest, safest things to extract into the framework first.
//
// Run `clone-apps.mjs` first so the apps are on disk. Then:
//
//   node similarity.mjs                 # markdown report to stdout
//   node similarity.mjs --json          # machine-readable JSON
//   node similarity.mjs --min 85        # only show candidates >= 85% similar
//   REFERENCE_DIR=.reference node similarity.mjs
//
// Similarity is a line-multiset Jaccard ratio (order-independent, fast,
// dependency-free): |lines(A) ∩ lines(B)| / |lines(A) ∪ lines(B)|, counting
// duplicates. Blank lines are ignored. It is a *ranking* heuristic, not a
// diff — 100% means "same set of non-blank lines", which is a strong signal
// the file is shared verbatim. Always read the real diff before extracting.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const referenceDir = resolve(process.env.REFERENCE_DIR ?? ".reference");
const apps = process.env.APPS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean) ?? ["notes", "checklist"];
const asJson = process.argv.includes("--json");
const minIdx = process.argv.indexOf("--min");
const minSim = minIdx >= 0 ? Number(process.argv[minIdx + 1]) : 0;

const LARGE_FILE_LIMIT = 1000; // OSS_SPEC §20.5 size smell.

// Files already migrated into the framework, matched by basename so a hook
// that moved from an app's `ui/hooks/foo.ts` to the framework's `hooks/foo.ts`
// still counts as done. Basename collisions are rare enough that dropping one
// is acceptable for a ranking tool; the agent reads the real diff regardless.
const migrated = new Set();
const frameworkSrc = resolve("src");
if (existsSync(frameworkSrc)) {
  for (const f of walk(frameworkSrc)) migrated.add(basename(f));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Path of a file relative to its app's src/, used as the cross-app key.
function srcKey(file, appRoot) {
  return relative(join(appRoot, "src"), file);
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

// Collect files per app, keyed by src-relative path.
const present = new Map(); // app -> Map<key, absPath>
for (const app of apps) {
  const root = join(referenceDir, app);
  if (!existsSync(join(root, "src"))) {
    console.error(
      `error: ${join(root, "src")} not found. Run clone-apps.mjs first.`,
    );
    process.exit(1);
  }
  const m = new Map();
  for (const f of walk(join(root, "src"))) m.set(srcKey(f, root), f);
  present.set(app, m);
}

// Keys shared by ALL apps are the comparable set.
const [first, ...rest] = apps;
const sharedKeys = [...present.get(first).keys()].filter(
  (k) => rest.every((a) => present.get(a).has(k)) && !migrated.has(basename(k)),
);

const rows = sharedKeys.map((key) => {
  const files = apps.map((a) => present.get(a).get(key));
  const lineSets = files.map(nonBlankLines);
  // Average pairwise similarity across all app pairs.
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < lineSets.length; i++) {
    for (let j = i + 1; j < lineSets.length; j++) {
      sum += similarity(lineSets[i], lineSets[j]);
      pairs++;
    }
  }
  const sim = pairs ? sum / pairs : 1;
  const rawMax = Math.max(
    ...files.map((f) => readFileSync(f, "utf8").split("\n").length),
  );
  return {
    path: key,
    module: key.split("/")[0],
    similarity: Math.round(sim * 100),
    lines: rawMax,
    large: rawMax > LARGE_FILE_LIMIT,
  };
});

rows.sort((a, b) => b.similarity - a.similarity || b.lines - a.lines);
const filtered = rows.filter((r) => r.similarity >= minSim);

// Per-module rollup: where do whole clusters of shared code live?
const byModule = new Map();
for (const r of rows) {
  const m = byModule.get(r.module) ?? { count: 0, sum: 0 };
  m.count++;
  m.sum += r.similarity;
  byModule.set(r.module, m);
}
const modules = [...byModule.entries()]
  .map(([module, { count, sum }]) => ({
    module,
    files: count,
    avgSimilarity: Math.round(sum / count),
  }))
  .sort((a, b) => b.avgSimilarity - a.avgSimilarity);

if (asJson) {
  console.log(JSON.stringify({ apps, candidates: filtered, modules }, null, 2));
} else {
  const pct = (n) => `${n}%`;
  console.log(`# Refactoring candidates\n`);
  console.log(`Apps compared: ${apps.join(", ")}`);
  console.log(
    `Shared files: ${rows.length}${minSim ? ` (showing ≥ ${minSim}%)` : ""}\n`,
  );
  console.log(`## By module (whole-cluster candidates)\n`);
  console.log(`| Module | Shared files | Avg similarity |`);
  console.log(`|--------|-------------:|---------------:|`);
  for (const m of modules) {
    console.log(`| ${m.module} | ${m.files} | ${pct(m.avgSimilarity)} |`);
  }
  console.log(`\n## By file (extract highest-similarity first)\n`);
  console.log(`| Similarity | Lines | File |`);
  console.log(`|-----------:|------:|------|`);
  for (const r of filtered) {
    const flag = r.large ? " ⚠️>1000" : "";
    console.log(`| ${pct(r.similarity)} | ${r.lines}${flag} | ${r.path} |`);
  }
  console.log(
    `\n⚠️ marks files over the OSS_SPEC §20.5 1000-line limit — split as part of extraction.`,
  );
}
