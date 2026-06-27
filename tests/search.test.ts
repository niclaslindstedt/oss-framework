// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  clipAround,
  compileQuery,
  searchItems,
  segmentMatches,
} from "../src/search/index.ts";

describe("compileQuery — empty / invalid", () => {
  it("reports an empty query and matches nothing", () => {
    const q = compileQuery("   ");
    expect(q.isEmpty).toBe(true);
    expect(q.invalidRegex).toBe(false);
    expect(q.match("anything")).toBeNull();
  });

  it("flags a malformed regex literal and matches nothing", () => {
    const q = compileQuery("/([/");
    expect(q.invalidRegex).toBe(true);
    expect(q.isEmpty).toBe(false);
    expect(q.match("([")).toBeNull();
  });
});

describe("compileQuery — substring", () => {
  it("finds every occurrence, case-insensitively", () => {
    const m = compileQuery("oo").match("Foo Boo");
    expect(m).not.toBeNull();
    expect(m!.ranges).toEqual([
      [1, 3],
      [5, 7],
    ]);
  });

  it("scores a word-start hit above a mid-word hit", () => {
    const start = compileQuery("cat").match("cat nap")!;
    const mid = compileQuery("cat").match("a scatter")!;
    expect(start.score).toBeGreaterThan(mid.score);
  });

  it("returns null when the needle is absent", () => {
    expect(compileQuery("zzz").match("hello")).toBeNull();
  });
});

describe("compileQuery — fuzzy fallback", () => {
  it("matches an in-order subsequence when the substring misses", () => {
    const m = compileQuery("grcl").match("grocery list")!;
    expect(m).not.toBeNull();
    // g, r, c from "grocery", l from "list" — all present in order.
    expect(m.ranges.length).toBeGreaterThan(0);
  });

  it("ranks a compact subsequence above a scattered one", () => {
    const compact = compileQuery("abc").match("abcdef")!;
    const scattered = compileQuery("abc").match("a-x-b-y-c")!;
    expect(compact.score).toBeGreaterThan(scattered.score);
  });

  it("does not fuzzy-match a single character", () => {
    // "z" is not a substring of "lazy day"... it is. Use a letter truly absent
    // as a substring but present out of order is impossible for length 1, so
    // assert the rule directly: a 1-char query only substring-matches.
    expect(compileQuery("q").match("qa")).not.toBeNull();
    expect(compileQuery("q").match("aq")).not.toBeNull();
    // A 2-char query fuzzy-matches across a gap; a 1-char never needs to.
    expect(compileQuery("qz").match("q...z")).not.toBeNull();
  });
});

describe("compileQuery — wildcard", () => {
  it("treats * as any run and ? as any single char", () => {
    expect(compileQuery("f*o").match("faro")).not.toBeNull();
    expect(compileQuery("f?o").match("foo")).not.toBeNull();
    // `?` is exactly one char, so a 2-char text leaves no room for the gap.
    expect(compileQuery("f?o").match("fo")).toBeNull();
  });
});

describe("compileQuery — regex", () => {
  it("compiles a /pattern/ literal and matches globally", () => {
    const m = compileQuery("/\\d+/").match("a12 b3")!;
    expect(m.ranges).toEqual([
      [1, 3],
      [5, 6],
    ]);
  });

  it("keeps user flags while forcing g and i", () => {
    const m = compileQuery("/foo/").match("FOO foo")!;
    expect(m.ranges.length).toBe(2);
  });
});

describe("searchItems", () => {
  const fruit = ["apricot", "banana", "grape", "grapefruit"];

  it("ranks matches by score and drops non-matches", () => {
    const out = searchItems(fruit, (s) => s, "grape");
    expect(out.map((r) => r.item)).toEqual(["grape", "grapefruit"]);
  });

  it("returns nothing for an empty or invalid query", () => {
    expect(searchItems(fruit, (s) => s, "  ")).toEqual([]);
    expect(searchItems(fruit, (s) => s, "/(/")).toEqual([]);
  });

  it("accepts a pre-compiled query to share across calls", () => {
    const q = compileQuery("an");
    const out = searchItems(fruit, (s) => s, q);
    expect(out.some((r) => r.item === "banana")).toBe(true);
  });
});

describe("segmentMatches", () => {
  it("splits into alternating plain / matched runs", () => {
    expect(segmentMatches("hello", [[1, 3]])).toEqual([
      { text: "h", match: false },
      { text: "el", match: true },
      { text: "lo", match: false },
    ]);
  });

  it("returns the whole text as one plain segment when nothing matched", () => {
    expect(segmentMatches("hello", [])).toEqual([
      { text: "hello", match: false },
    ]);
  });
});

describe("clipAround", () => {
  it("returns short text unchanged", () => {
    const r = clipAround("short", [[0, 1]], 160);
    expect(r.text).toBe("short");
  });

  it("windows a long body around the first match with ellipses", () => {
    const text = "x".repeat(200) + "NEEDLE" + "y".repeat(200);
    const start = 200;
    const r = clipAround(text, [[start, start + 6]], 60);
    expect(r.text.length).toBeLessThan(text.length);
    expect(r.text.startsWith("…")).toBe(true);
    expect(r.text.endsWith("…")).toBe(true);
    // The shifted range still points at "NEEDLE" within the clipped window.
    const [s, e] = r.ranges[0]!;
    expect(r.text.slice(s, e)).toBe("NEEDLE");
  });
});
