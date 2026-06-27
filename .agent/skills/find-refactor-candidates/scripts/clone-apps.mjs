#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Clone (or refresh) the source apps the framework is extracted from, so the
// find-refactor-candidates skill has them on disk to compare against.
//
// The public GitHub remotes are not reachable from the agent sandbox; the
// repos are mirrored to GitLab and reached with a short-lived token. Both
// values come from the environment so no credential is ever written to disk
// or committed:
//
//   MIRROR_BASE   e.g. "gitlab.com/niclaslindstedt/"  (note the trailing slash)
//   MIRROR_TOKEN  a GitLab access token with read_repository scope
//
// Usage:
//   node clone-apps.mjs                 # clone/refresh the default app(s)
//   node clone-apps.mjs budget          # explicit list
//   APPS=budget node clone-apps.mjs
//   REFERENCE_DIR=.reference node clone-apps.mjs
//
// The clones land in REFERENCE_DIR (default ".reference/", git-ignored). An
// existing clone is fetched and hard-reset to its default branch rather than
// re-cloned. An empty mirror (no commits yet) clones cleanly and is left
// in place — `similarity.mjs` skips a source app that has no `src/` so the
// skill degrades gracefully until the mirror is populated.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_APPS = ["budget"];

const apps =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : (process.env.APPS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? DEFAULT_APPS);

const referenceDir = resolve(process.env.REFERENCE_DIR ?? ".reference");

const base = process.env.MIRROR_BASE;
const token = process.env.MIRROR_TOKEN;

if (!base || !token) {
  console.error(
    "error: MIRROR_BASE and MIRROR_TOKEN must be set.\n" +
      "  MIRROR_BASE   e.g. gitlab.com/niclaslindstedt/ (trailing slash)\n" +
      "  MIRROR_TOKEN  a GitLab token with read_repository scope",
  );
  process.exit(1);
}

// Build the authenticated URL. `oauth2:<token>` is GitLab's HTTP token form.
// Kept in a local only — never logged.
function remoteFor(app) {
  const cleanBase = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://oauth2:${token}@${cleanBase}/${app}.git`;
}

// Resolve the remote default branch, or null for an empty mirror (a freshly
// created repo with no commits has no `origin/HEAD`, so rev-parse fails).
function defaultBranch(dest) {
  try {
    return execFileSync(
      "git",
      ["-C", dest, "rev-parse", "--abbrev-ref", "origin/HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return null;
  }
}

// Run git, echoing a redacted command line so a leaked token never reaches
// the logs. stdio inherits so progress is visible.
function git(args, opts = {}) {
  const redacted = args.map((a) => a.replace(/oauth2:[^@]+@/, "oauth2:***@"));
  console.log(`  $ git ${redacted.join(" ")}`);
  execFileSync("git", args, { stdio: "inherit", ...opts });
}

mkdirSync(referenceDir, { recursive: true });

for (const app of apps) {
  const dest = join(referenceDir, app);
  console.log(`\n• ${app} → ${dest}`);
  if (existsSync(join(dest, ".git"))) {
    // Refresh in place: fetch, then hard-reset to the remote default branch.
    git(["-C", dest, "remote", "set-url", "origin", remoteFor(app)]);
    git(["-C", dest, "fetch", "--depth", "1", "origin"]);
    const head = defaultBranch(dest);
    if (head) {
      git(["-C", dest, "reset", "--hard", head]);
    } else {
      console.log("  (empty mirror — no default branch yet; nothing to reset)");
    }
  } else {
    git(["clone", "--depth", "1", remoteFor(app), dest]);
  }
  // Drop the credentialed remote URL so the token isn't left in .git/config.
  git([
    "-C",
    dest,
    "remote",
    "set-url",
    "origin",
    `https://${base.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/${app}.git`,
  ]);
}

console.log(`\nDone. ${apps.length} app(s) under ${referenceDir}/`);
