// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A forward-only migration runner for a persisted document. The stored JSON
// carries a top-level numeric `version`; each step in the table migrates a
// document from version `N` to `N+1`. This is the generic *engine* — the
// chain of steps and the latest version are your app's data (the shape of
// what you persist), injected through `createMigrator`.
//
// Versioning is a property of the bytes at rest, not of your in-memory model,
// so it lives entirely at this seam (and your serialize step, which stamps the
// latest version onto every freshly-written document). Your domain types stay
// version-free.
//
// Once a migration ships it must never be removed or rewritten — documents in
// the wild (and exports) still depend on it to upgrade cleanly. To add a new
// version: bump the `latestVersion` you pass in, add the next step keyed by the
// version it upgrades *from*, and update your in-memory type in the same change
// if its shape moved.

import { noopLogger, type Logger } from "./logger.ts";

/** A parsed document at rest: a numeric `version` plus arbitrary fields. */
export type Versioned = { version: number; [key: string]: unknown };

/** Upgrades a document one version forward (`N` → `N+1`). */
export type MigrationStep = (doc: Versioned) => Versioned;

/**
 * The migration chain, keyed by the version each step upgrades *from*:
 * `migrations[N]` turns a v`N` document into v`N+1`.
 */
export type MigrationTable = Record<number, MigrationStep>;

/** The outcome of running a document through the chain. */
export type MigrationResult = {
  /** The document at `latestVersion`. */
  data: Versioned;
  /** `true` if at least one step ran (the document was upgraded). */
  migrated: boolean;
};

/** What `createMigrator` needs: your chain, your latest version, an optional sink. */
export interface MigratorConfig {
  /** Forward-only steps: `migrations[N]` upgrades a v`N` doc to v`N+1`. */
  migrations: MigrationTable;
  /** The version every freshly-written document carries — the chain's target. */
  latestVersion: number;
  /** Diagnostics sink for the one "migrated vX → vY" line (default: no-op). */
  logger?: Logger;
}

/** A bound runner: `migrate` a parsed value, and the `latestVersion` to stamp. */
export interface Migrator {
  /**
   * Run a parsed document forward to `latestVersion`. A value with no numeric
   * `version` is treated as version 0 (the pre-versioning shape). Throws when
   * the document was written by a newer build than this one, or when a step in
   * the chain is missing.
   */
  migrate(raw: unknown): MigrationResult;
  /** The target version — stamp this onto documents you write. */
  readonly latestVersion: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Pre-versioning documents have no `version` field — read those as 0. A
// present-but-non-numeric `version` is also coerced to 0 so a corrupt header
// re-runs the chain from the start rather than throwing.
function numericVersion(raw: unknown): number {
  if (isObj(raw) && typeof raw.version === "number") return raw.version;
  return 0;
}

/**
 * Build a {@link Migrator} from your migration chain. The runner is generic;
 * the steps and `latestVersion` are your app's data model.
 *
 * ```ts
 * const migrator = createMigrator({
 *   latestVersion: 2,
 *   migrations: {
 *     0: (doc) => ({ ...doc, version: 1, items: doc.items ?? [] }),
 *     1: (doc) => ({ ...doc, version: 2, items: upgradeItems(doc.items) }),
 *   },
 *   logger: consoleLogger("migrate"),
 * });
 *
 * const { data, migrated } = migrator.migrate(JSON.parse(raw));
 * ```
 */
export function createMigrator(config: MigratorConfig): Migrator {
  const { migrations, latestVersion, logger = noopLogger } = config;

  function migrate(raw: unknown): MigrationResult {
    const doc: Versioned = isObj(raw)
      ? { ...(raw as Record<string, unknown>), version: numericVersion(raw) }
      : { version: 0 };

    if (doc.version > latestVersion) {
      throw new Error(
        `Data was created by a newer version of the app (v${doc.version}); ` +
          `this build supports up to v${latestVersion}.`,
      );
    }

    let current = doc;
    let migrated = false;
    while (current.version < latestVersion) {
      const step = migrations[current.version];
      if (!step) {
        throw new Error(
          `No migration registered from v${current.version} to v${current.version + 1}.`,
        );
      }
      current = step(current);
      migrated = true;
    }
    if (migrated) {
      logger.info(`migrated v${doc.version} → v${current.version}`);
    }
    return { data: current, migrated };
  }

  return { migrate, latestVersion };
}
