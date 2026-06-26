// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildFeatureDocs,
  parseChangelog,
  parseFeatureDoc,
} from "../src/changelog/index.ts";

describe("parseChangelog", () => {
  it("parses releases newest-first with their date and sections", () => {
    const md = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "## [0.2.0] - 2026-06-18",
      "",
      "### Added",
      "",
      "- A new feature.",
      "- Another one.",
      "",
      "### Fixed",
      "",
      "- A bug.",
      "",
      "## [0.1.0] - 2026-01-01",
      "",
      "### Added",
      "",
      "- Initial scaffold.",
    ].join("\n");

    const releases = parseChangelog(md);
    expect(releases.map((r) => r.version)).toEqual(["0.2.0", "0.1.0"]);

    const [latest] = releases;
    expect(latest!.date).toBe("2026-06-18");
    expect(latest!.sections).toEqual([
      { type: "Added", items: ["A new feature.", "Another one."] },
      { type: "Fixed", items: ["A bug."] },
    ]);
  });

  it("drops the empty Unreleased stub", () => {
    const releases = parseChangelog(
      "## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Ship it.",
    );
    expect(releases.map((r) => r.version)).toEqual(["1.0.0"]);
  });

  it("keeps an Unreleased section that actually has content", () => {
    const releases = parseChangelog(
      "## [Unreleased]\n\n### Added\n\n- Pending change.",
    );
    expect(releases).toHaveLength(1);
    expect(releases[0]!.version).toBe("Unreleased");
    expect(releases[0]!.date).toBeNull();
  });

  it("joins a wrapped bullet's continuation lines", () => {
    const releases = parseChangelog(
      "## [1.0.0] - 2026-01-01\n\n### Added\n\n- A bullet that\n  wraps across lines.",
    );
    expect(releases[0]!.sections[0]!.items).toEqual([
      "A bullet that\nwraps across lines.",
    ]);
  });

  it("ignores unknown section headings", () => {
    const releases = parseChangelog(
      "## [1.0.0] - 2026-01-01\n\n### Bogus\n\n- Not a real kind.\n\n### Added\n\n- Real.",
    );
    expect(releases[0]!.sections).toEqual([
      { type: "Added", items: ["Real."] },
    ]);
  });

  // Dogfood: the framework's own CHANGELOG.md must parse cleanly, since the
  // `changelog` component is what a consuming app would render it through.
  it("parses this repository's own CHANGELOG.md", () => {
    // Vitest runs with the repo root as cwd, so a bare relative path resolves
    // to the framework's own CHANGELOG.md.
    const md = readFileSync("CHANGELOG.md", "utf8");
    const releases = parseChangelog(md);
    // Every parsed release has a version; only Unreleased may lack a date.
    for (const r of releases) {
      expect(r.version).toBeTruthy();
      if (r.version !== "Unreleased")
        expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("parseFeatureDoc", () => {
  it("splits the leading H1 title from the body", () => {
    const doc = parseFeatureDoc(
      "storage",
      "# Storage backends\n\nPick where data lives.",
    );
    expect(doc).toEqual({
      slug: "storage",
      title: "Storage backends",
      body: "Pick where data lives.",
    });
  });

  it("skips leading blank lines before the title", () => {
    const doc = parseFeatureDoc("x", "\n\n# Title\n\nBody.");
    expect(doc.title).toBe("Title");
    expect(doc.body).toBe("Body.");
  });

  it("falls back to the slug when there is no leading heading", () => {
    const doc = parseFeatureDoc("namespaces", "Just prose, no heading.");
    expect(doc.title).toBe("namespaces");
    expect(doc.body).toBe("Just prose, no heading.");
  });

  it("normalises CRLF line endings", () => {
    const doc = parseFeatureDoc("x", "# Title\r\n\r\nLine one.\r\nLine two.");
    expect(doc.title).toBe("Title");
    expect(doc.body).toBe("Line one.\nLine two.");
  });
});

describe("buildFeatureDocs", () => {
  it("keys a glob result by each path's filename stem", () => {
    const docs = buildFeatureDocs({
      "./docs/features/theming.md": "# Theming\n\nHow themes work.",
      "../elsewhere/storage.md": "# Storage\n\nWhere data lives.",
    });
    expect(Object.keys(docs).sort()).toEqual(["storage", "theming"]);
    expect(docs.theming!.title).toBe("Theming");
    expect(docs.storage!.body).toBe("Where data lives.");
  });
});
