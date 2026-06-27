// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createMigrator,
  type Versioned,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import type { AppData, Folder, List } from "./types.ts";

// The demo's persisted-document migration chain — dogfooding the framework's
// `createMigrator`. The framework owns the engine (run a parsed document
// forward, throw on a newer-than-build or gappy chain); the *steps* below are
// the demo's own data model, exactly the seam the storage module draws.
//
// The version lives only on the bytes at rest: `AppData` (the in-memory model)
// stays version-free; `useChecklistStore` stamps `LATEST_VERSION` when it
// writes and runs `migrator.migrate` when it reads.

/** The current persisted-document version. Bump it and add a step below when
 *  the on-disk shape changes — every shipped step stays forever. */
export const LATEST_VERSION = 2;

const migrations = {
  // v0 (pre-versioning) → v1: the bootstrap step. The demo's original document
  // had no `version` field; normalise a legacy/partial file by guaranteeing the
  // two arrays and the active-list pointer exist so the screen never reads a
  // missing field.
  0: (doc: Versioned): Versioned => {
    const lists = Array.isArray(doc.lists) ? doc.lists : [];
    return {
      ...doc,
      version: 1,
      folders: Array.isArray(doc.folders) ? doc.folders : [],
      lists,
      activeListId:
        typeof doc.activeListId === "string"
          ? doc.activeListId
          : ((lists[0] as List | undefined)?.id ?? ""),
    };
  },
  // v1 → v2: lists used to store their items as plain label strings; lift each
  // bare string into a checkable `ChecklistNode`. A list whose items are
  // already nodes passes through unchanged, so a v1 document written by a build
  // that already used nodes upgrades to a no-op shape change.
  1: (doc: Versioned): Versioned => ({
    ...doc,
    version: 2,
    lists: (Array.isArray(doc.lists) ? doc.lists : []).map((raw, li) => {
      const list = raw as Record<string, unknown>;
      const items = Array.isArray(list.items) ? list.items : [];
      return {
        ...list,
        items: items.map((item, ii) =>
          typeof item === "string"
            ? { id: `legacy-${li}-${ii}`, label: item, checked: false }
            : item,
        ),
      };
    }),
  }),
} as const;

export const migrator = createMigrator({
  latestVersion: LATEST_VERSION,
  migrations,
  // Route the one "migrated vX → vY" line into the same in-app buffer the Logs
  // tab renders — so an upgrade is visible, not silent.
  logger: logStore.createLogger("migrate"),
});

/** Narrow a migrated document back to the app's version-free model. The chain
 *  guarantees the fields exist; this just re-asserts the static shape. */
export function toAppData(doc: Versioned): AppData {
  return {
    folders: (Array.isArray(doc.folders) ? doc.folders : []) as Folder[],
    lists: (Array.isArray(doc.lists) ? doc.lists : []) as List[],
    activeListId: typeof doc.activeListId === "string" ? doc.activeListId : "",
  };
}

/** A genuine pre-versioning (v0) document, used by the Developer tab to show
 *  the migrator climbing a real legacy file to today's shape: note there is no
 *  `version` field and the items are bare strings, the v1 shape. */
export function legacyDocument(): unknown {
  return {
    activeListId: "legacy-shopping",
    folders: [],
    lists: [
      {
        id: "legacy-shopping",
        title: "Legacy shopping list",
        folderId: null,
        items: ["Milk", "Bread", "Coffee", "Eggs"],
      },
    ],
  };
}
