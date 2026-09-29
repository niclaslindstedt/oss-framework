// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  memoryByteStore,
  planReconcile,
  reconcileFiles,
  scopedByteStore,
} from "../src/storage/index.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

describe("planReconcile", () => {
  it("sends what is here, fetches what is there, prunes what nobody wants", () => {
    const plan = planReconcile({
      local: ["a", "b", "old"],
      remote: ["b", "c", "gone"],
      wanted: ["a", "b", "c"],
    });
    expect(plan).toEqual({ push: ["a"], pull: ["c"], prune: ["gone"] });
  });

  it("leaves a wanted file nobody has alone", () => {
    const plan = planReconcile({ local: [], remote: [], wanted: ["x"] });
    expect(plan).toEqual({ push: [], pull: [], prune: [] });
  });
});

describe("reconcileFiles", () => {
  it("moves the bytes both ways and prunes the far side", async () => {
    const local = memoryByteStore();
    const remote = memoryByteStore();
    await local.writeBytes("a", bytes("A"));
    await remote.writeBytes("c", bytes("C"));
    await remote.writeBytes("gone", bytes("G"));
    const result = await reconcileFiles({ local, remote, wanted: ["a", "c"] });
    expect(result).toEqual({
      pushed: ["a"],
      pulled: ["c"],
      pruned: ["gone"],
      failed: [],
    });
    expect(text(await remote.readBytes("a"))).toBe("A");
    expect(text(await local.readBytes("c"))).toBe("C");
    expect(await remote.readBytes("gone")).toBeNull();
  });

  it("can be told not to prune or push", async () => {
    const local = memoryByteStore();
    const remote = memoryByteStore();
    await local.writeBytes("a", bytes("A"));
    await remote.writeBytes("gone", bytes("G"));
    const result = await reconcileFiles({
      local,
      remote,
      wanted: ["a"],
      prune: false,
      push: false,
    });
    expect(result.pushed).toEqual([]);
    expect(result.pruned).toEqual([]);
    expect(await remote.readBytes("gone")).not.toBeNull();
  });

  it("reports a failure and carries on", async () => {
    const local = memoryByteStore();
    const remote = memoryByteStore();
    await local.writeBytes("a", bytes("A"));
    await local.writeBytes("b", bytes("B"));
    const flaky = {
      ...remote,
      async writeBytes(path: string, data: Uint8Array) {
        if (path === "a") throw new Error("no");
        return remote.writeBytes(path, data);
      },
    };
    const progress: number[] = [];
    const result = await reconcileFiles({
      local,
      remote: flaky,
      wanted: ["a", "b"],
      onProgress: (done) => progress.push(done),
    });
    expect(result.pushed).toEqual(["b"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ path: "a", op: "push" });
    expect(progress).toEqual([1, 2]);
  });

  it("transforms bytes up and down", async () => {
    const local = memoryByteStore();
    const remote = memoryByteStore();
    await local.writeBytes("a", bytes("A"));
    await remote.writeBytes("b", bytes("!B"));
    await reconcileFiles({
      local,
      remote,
      wanted: ["a", "b"],
      transform: {
        up: async (b) => bytes("!" + text(b)),
        down: async (b) => bytes(text(b)!.slice(1)),
      },
    });
    expect(text(await remote.readBytes("a"))).toBe("!A");
    expect(text(await local.readBytes("b"))).toBe("B");
  });
});

describe("scopedByteStore", () => {
  it("confines a store to a folder", async () => {
    const root = memoryByteStore();
    await root.writeBytes("other/x", bytes("X"));
    const scoped = scopedByteStore(root, "/mine/");
    await scoped.writeBytes("a", bytes("A"));
    expect((await root.list()).map((e) => e.path).sort()).toEqual([
      "mine/a",
      "other/x",
    ]);
    expect((await scoped.list()).map((e) => e.path)).toEqual(["a"]);
    expect(text(await scoped.readBytes("a"))).toBe("A");
    await scoped.remove("a");
    expect(await root.readBytes("mine/a")).toBeNull();
    expect(await root.readBytes("other/x")).not.toBeNull();
  });
});
