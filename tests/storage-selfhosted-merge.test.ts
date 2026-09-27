// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { newerByField, threeWayMerge } from "../src/storage/selfhosted/merge.ts";

describe("threeWayMerge", () => {
  it("takes the side that changed", () => {
    expect(threeWayMerge({ a: 1 }, { a: 1 }, { a: 2 })).toEqual({ a: 2 });
    expect(threeWayMerge({ a: 1 }, { a: 3 }, { a: 1 })).toEqual({ a: 3 });
    expect(threeWayMerge(1, 5, 5)).toBe(5);
  });

  it("merges different fields edited on each side", () => {
    const base = { name: "Ibuprofen", dose: "200mg", schedule: ["08:00"] };
    const local = { ...base, dose: "400mg" };
    const remote = { ...base, schedule: ["08:00", "20:00"] };
    expect(threeWayMerge(base, local, remote)).toEqual({ name: "Ibuprofen", dose: "400mg", schedule: ["08:00", "20:00"] });
  });

  it("recurses into nested objects and handles added/removed keys", () => {
    const base = { taken: { "m1@08:00": "t1" }, skipped: {} };
    const local = { taken: { "m1@08:00": "t1", "m2@08:00": "t2" }, skipped: {} };
    const remote = { taken: {}, skipped: { "m3@12:00": "t3" } };
    expect(threeWayMerge(base, local, remote)).toEqual({ taken: { "m2@08:00": "t2" }, skipped: { "m3@12:00": "t3" } });
  });

  it("with no base, merges both sides' keys", () => {
    expect(threeWayMerge(undefined, { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("resolves true conflicts with the resolver (default: local)", () => {
    expect(threeWayMerge({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
    const seen: string[][] = [];
    const merged = threeWayMerge({ a: { b: 1 } }, { a: { b: 2 } }, { a: { b: 3 } }, {
      resolve: ({ path, remote }) => {
        seen.push(path);
        return remote;
      },
    });
    expect(merged).toEqual({ a: { b: 3 } });
    expect(seen).toEqual([["a", "b"]]);
  });

  it("union-merges arrays when asked", () => {
    const base = { tags: ["a", "b"] };
    const local = { tags: ["a", "b", "c"] };
    const remote = { tags: ["b", "d"] };
    expect(threeWayMerge(base, local, remote, { arrays: "union" })).toEqual({ tags: ["b", "c", "d"] });
    // default: arrays are values; both changed -> resolver (local)
    expect(threeWayMerge(base, local, remote)).toEqual(local);
  });

  it("edit beats delete unless deleteWins", () => {
    const base = { a: 1, b: 1 };
    const local = { b: 1 }; // deleted a
    const remote = { a: 2, b: 1 }; // edited a
    expect(threeWayMerge(base, local, remote)).toEqual({ a: 2, b: 1 });
    expect(threeWayMerge(base, local, remote, { deleteWins: true })).toEqual({ b: 1 });
  });
});

describe("newerByField", () => {
  it("picks the side with the newer timestamp field", () => {
    const pick = newerByField("updatedAt");
    const local = { v: 1, updatedAt: "2026-09-27T10:00:00Z" };
    const remote = { v: 2, updatedAt: "2026-09-27T11:00:00Z" };
    expect(pick({ path: ["v"], base: 0, local: 1, remote: 2, localRoot: local, remoteRoot: remote })).toBe(2);
    expect(pick({ path: ["v"], base: 0, local: 1, remote: 2, localRoot: { ...local, updatedAt: 2e12 }, remoteRoot: { ...remote, updatedAt: 1e12 } })).toBe(1);
    // ties go to remote, so both devices converge
    expect(pick({ path: ["v"], base: 0, local: 1, remote: 2, localRoot: local, remoteRoot: { ...remote, updatedAt: local.updatedAt } })).toBe(2);
  });
});
