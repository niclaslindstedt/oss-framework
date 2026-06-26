// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

import type { AppData } from "./types.ts";

// The starting document the demo boots with — the same lists the screenshots
// show. The flagship "Att köpa" (Swedish for "To buy") is the active list: a
// flat shopping list of four items. The "Packlistor" (packing lists) folder
// groups four more lists, one of which nests a child checklist to show the
// tree depth off. A second standalone "Hej" rounds out the menu.
//
// `checkedAt` stamps use fixed timestamps so the "sort checked to the bottom"
// order is deterministic across reloads (no wall-clock in the seed).

const leaf = (id: string, label: string, checked = false): ChecklistNode =>
  checked
    ? { id, label, checked, checkedAt: `2024-01-01T00:00:00.000Z` }
    : { id, label, checked };

export const SEED: AppData = {
  namespace: "Default",
  activeListId: "att-kopa",
  folders: [{ id: "packlistor", name: "Packlistor" }],
  lists: [
    // A standalone list — sits above the active one in the menu's root.
    {
      id: "hej-standalone",
      title: "Hej",
      folderId: null,
      items: [leaf("h1", "Ring tandläkaren"), leaf("h2", "Boka bord")],
    },
    // The active list — flat, four items, nothing checked (0 / 4).
    {
      id: "att-kopa",
      title: "Att köpa",
      folderId: null,
      items: [
        leaf("inotyol", "Inotyol"),
        leaf("tomater", "Tomater"),
        leaf("yoghurt", "Yoghurt"),
        leaf("mjolk", "Mjölk"),
      ],
    },
    // The packing-lists folder.
    {
      id: "ojerud",
      title: "Öjerud",
      folderId: "packlistor",
      items: [leaf("o1", "Tält"), leaf("o2", "Sovsäck")],
    },
    {
      id: "packlista",
      title: "Packlista",
      folderId: "packlistor",
      // A nested child checklist — shows the framework's tree depth.
      items: [
        {
          id: "p-dok",
          label: "Dokument",
          checked: false,
          children: [
            leaf("p-pass", "Pass", true),
            leaf("p-bilj", "Biljetter", true),
          ],
        },
      ],
    },
    {
      id: "att-kopa-2",
      title: "Att köpa",
      folderId: "packlistor",
      items: [leaf("a1", "Bröd"), leaf("a2", "Smör"), leaf("a3", "Ägg")],
    },
    {
      id: "hej-folder",
      title: "Hej",
      folderId: "packlistor",
      items: [leaf("hf1", "Ett"), leaf("hf2", "Två"), leaf("hf3", "Tre")],
    },
  ],
};
