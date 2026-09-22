// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  changedPaths,
  mergeRevisions,
  recordRevision,
  revisionAt,
  sameRecord,
} from "../src/revisions/revisions.ts";

type Rec = { name: string; address: { city: string }; tags?: string[] };

const a: Rec = { name: "Acme", address: { city: "Malmö" } };
const b: Rec = { name: "Acme", address: { city: "Lund" } };

describe("sameRecord", () => {
  it("compares structure, not identity or key order", () => {
    expect(sameRecord({ x: 1, y: 2 }, { y: 2, x: 1 })).toBe(true);
    expect(sameRecord(a, { ...a, address: { ...a.address } })).toBe(true);
    expect(sameRecord(a, b)).toBe(false);
  });

  it("tells arrays from objects and primitives from each other", () => {
    expect(sameRecord([1, 2], [1, 2])).toBe(true);
    expect(sameRecord([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(sameRecord(null, {})).toBe(false);
    expect(sameRecord("1", 1)).toBe(false);
    expect(sameRecord({ x: undefined }, {})).toBe(false);
  });
});

describe("recordRevision", () => {
  it("appends a changed snapshot and skips an unchanged one", () => {
    const h1 = recordRevision<Rec>([], a, "2026-01-01T00:00:00Z");
    expect(h1).toHaveLength(1);
    const h2 = recordRevision(h1, { ...a }, "2026-01-02T00:00:00Z");
    expect(h2).toHaveLength(1);
    const h3 = recordRevision(h2, b, "2026-01-03T00:00:00Z");
    expect(h3).toHaveLength(2);
    expect(h3[1]?.data.address.city).toBe("Lund");
  });

  it("files a snapshot by its stamp", () => {
    const h = recordRevision(
      recordRevision<Rec>([], a, "2026-01-05T00:00:00Z"),
      b,
      "2026-01-01T00:00:00Z",
    );
    expect(h.map((r) => r.at)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-05T00:00:00Z",
    ]);
  });

  it("compares against the latest, not the one a late save lands beside", () => {
    // `a` is the latest; a late save of `a` stamped earlier is still nothing new.
    const h = recordRevision<Rec>([], a, "2026-01-05T00:00:00Z");
    expect(recordRevision(h, a, "2026-01-01T00:00:00Z")).toHaveLength(1);
  });

  it("never mutates the history it was given", () => {
    const h1 = recordRevision<Rec>([], a, "2026-01-01T00:00:00Z");
    const copy = [...h1];
    recordRevision(h1, b, "2026-01-02T00:00:00Z");
    expect(h1).toEqual(copy);
  });
});

describe("revisionAt", () => {
  const history = [
    { at: "2026-01-01T00:00:00Z", data: a },
    { at: "2026-03-01T00:00:00Z", data: b },
  ];

  it("answers the version in force at a moment", () => {
    expect(revisionAt(history, "2026-02-01T00:00:00Z")?.data).toBe(a);
    expect(revisionAt(history, "2026-03-01T00:00:00Z")?.data).toBe(b);
    expect(revisionAt(history, "2027-01-01T00:00:00Z")?.data).toBe(b);
  });

  it("answers null before the record existed, and on an empty history", () => {
    expect(revisionAt(history, "2025-01-01T00:00:00Z")).toBeNull();
    expect(revisionAt([], "2026-01-01T00:00:00Z")).toBeNull();
  });
});

describe("mergeRevisions", () => {
  it("unions two histories by stamp, in order, keeping the first side's on a tie", () => {
    const mine = [
      { at: "2026-01-01T00:00:00Z", data: a },
      { at: "2026-04-01T00:00:00Z", data: { ...b, name: "Acme AB" } },
    ];
    const theirs = [
      { at: "2026-01-01T00:00:00Z", data: { ...a, name: "Tie" } },
      { at: "2026-02-01T00:00:00Z", data: b },
    ];
    const merged = mergeRevisions(mine, theirs);
    expect(merged.map((r) => r.at)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-04-01T00:00:00Z",
    ]);
    expect(merged[0]?.data.name).toBe("Acme");
  });

  it("is the identity on an empty other side", () => {
    const mine = [{ at: "2026-01-01T00:00:00Z", data: a }];
    expect(mergeRevisions(mine, [])).toEqual(mine);
    expect(mergeRevisions([], mine)).toEqual(mine);
  });
});

describe("changedPaths", () => {
  it("names the dotted paths that differ, sorted", () => {
    expect(changedPaths(a, b)).toEqual(["address.city"]);
    expect(
      changedPaths(a, { name: "Beta", address: { city: "Lund" } }),
    ).toEqual(["address.city", "name"]);
    expect(changedPaths(a, a)).toEqual([]);
  });

  it("reports a side that is missing at its own path, and arrays whole", () => {
    expect(changedPaths({ x: { y: 1 } }, {})).toEqual(["x"]);
    expect(changedPaths({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual([
      "tags",
    ]);
  });

  it("reports two differing primitives as the root", () => {
    expect(changedPaths(1, 2)).toEqual(["."]);
  });
});
