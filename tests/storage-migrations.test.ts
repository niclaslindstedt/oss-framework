// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it, vi } from "vitest";

import {
  createMigrator,
  type Logger,
  type MigrationTable,
} from "../src/storage/index.ts";

// A two-step chain mirroring a realistic schema evolution: v0 → v1 bootstraps
// the array, v1 → v2 reshapes each item from a bare string to an object.
const migrations: MigrationTable = {
  0: (doc) => ({
    ...doc,
    version: 1,
    items: Array.isArray(doc.items) ? doc.items : [],
  }),
  1: (doc) => ({
    ...doc,
    version: 2,
    items: (doc.items as unknown[]).map((it) =>
      typeof it === "string" ? { label: it, done: false } : it,
    ),
  }),
};

const make = (logger?: Logger) =>
  createMigrator({ migrations, latestVersion: 2, logger });

describe("createMigrator", () => {
  it("exposes the target latestVersion", () => {
    expect(make().latestVersion).toBe(2);
  });

  it("treats a pre-versioning document as v0 and runs the full chain", () => {
    const { data, migrated } = make().migrate({ items: ["milk", "bread"] });
    expect(migrated).toBe(true);
    expect(data.version).toBe(2);
    expect(data.items).toEqual([
      { label: "milk", done: false },
      { label: "bread", done: false },
    ]);
  });

  it("coerces a non-object value to an empty v0 document", () => {
    const { data, migrated } = make().migrate(null);
    expect(migrated).toBe(true);
    expect(data).toEqual({ version: 2, items: [] });
  });

  it("coerces a non-numeric version to 0 so the chain re-runs", () => {
    const { data } = make().migrate({ version: "oops", items: ["x"] });
    expect(data.version).toBe(2);
    expect(data.items).toEqual([{ label: "x", done: false }]);
  });

  it("runs only the remaining steps for a partially-migrated document", () => {
    const { data, migrated } = make().migrate({
      version: 1,
      items: ["already-an-array"],
    });
    expect(migrated).toBe(true);
    expect(data.items).toEqual([{ label: "already-an-array", done: false }]);
  });

  it("is a no-op for a document already at the latest version", () => {
    const doc = { version: 2, items: [{ label: "x", done: true }] };
    const { data, migrated } = make().migrate(doc);
    expect(migrated).toBe(false);
    expect(data.items).toEqual(doc.items);
  });

  it("throws when the document is newer than this build supports", () => {
    expect(() => make().migrate({ version: 3 })).toThrow(
      /newer version of the app \(v3\)/,
    );
  });

  it("throws when a step in the chain is missing", () => {
    const gappy = createMigrator({
      latestVersion: 3,
      migrations: { 0: (d) => ({ ...d, version: 1 }) },
    });
    expect(() => gappy.migrate({ version: 1 })).toThrow(
      /No migration registered from v1 to v2/,
    );
  });

  it("logs exactly one line when it migrates, and none when it doesn't", () => {
    const info = vi.fn();
    const logger: Logger = { info, warn: vi.fn(), error: vi.fn() };

    make(logger).migrate({ items: ["x"] });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith("migrated v0 → v2");

    info.mockClear();
    make(logger).migrate({ version: 2, items: [] });
    expect(info).not.toHaveBeenCalled();
  });

  it("defaults to a no-op logger when none is given", () => {
    expect(() => make().migrate({ items: ["x"] })).not.toThrow();
  });
});
