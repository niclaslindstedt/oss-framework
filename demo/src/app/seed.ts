// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

import type { AppData } from "./types.ts";

// The starting document the demo boots with — realistic shopping and packing
// lists for an ordinary Swedish household. The active list is the weekly
// grocery run ("Veckohandling"); the "Packlistor" folder groups the family's
// recurring packing lists (a mountain hike, a charter holiday, the summer
// cabin, the kids' bag), a couple of which nest a sub-list to show the tree
// depth. A second standalone list rounds out the menu. Each list carries a
// `glyph` + `color` from the framework's `/glyphs` catalogue, so the side-menu
// icons and the tab favicon read in the list's own colour out of the box.
//
// `checkedAt` stamps use a fixed timestamp so the "sort checked to the bottom"
// order is deterministic across reloads (no wall-clock in the seed).

const leaf = (id: string, label: string, checked = false): ChecklistNode =>
  checked
    ? { id, label, checked, checkedAt: `2024-01-01T00:00:00.000Z` }
    : { id, label, checked };

export const SEED: AppData = {
  namespace: "Default",
  activeListId: "veckohandling",
  folders: [{ id: "packlistor", name: "Packlistor" }],
  lists: [
    // A short standalone shopping list — sits above the active one in the menu.
    {
      id: "apoteket",
      title: "Apoteket",
      folderId: null,
      glyph: "heart",
      color: "#e06c75",
      items: [
        leaf("ap-alvedon", "Alvedon"),
        leaf("ap-plaster", "Plåster"),
        leaf("ap-nassprej", "Nässprej"),
        leaf("ap-solskydd", "Solskyddsfaktor 30"),
      ],
    },
    // The active list — the weekly grocery run.
    {
      id: "veckohandling",
      title: "Veckohandling",
      folderId: null,
      glyph: "cart",
      color: "#98c379",
      items: [
        leaf("vh-mjolk", "Mellanmjölk 1,5 %"),
        leaf("vh-fil", "Filmjölk"),
        leaf("vh-smor", "Bregott"),
        leaf("vh-agg", "Ägg"),
        leaf("vh-knacke", "Knäckebröd"),
        leaf("vh-kaffe", "Bryggkaffe"),
        leaf("vh-bananer", "Bananer"),
        leaf("vh-gurka", "Gurka"),
        leaf("vh-morotter", "Morötter"),
        leaf("vh-kottbullar", "Köttbullar"),
        leaf("vh-pasta", "Pasta"),
        leaf("vh-krossade", "Krossade tomater"),
        leaf("vh-lok", "Gul lök"),
        leaf("vh-ost", "Lagrad ost"),
        leaf("vh-toapapper", "Toalettpapper", true),
        leaf("vh-diskmedel", "Diskmedel", true),
      ],
    },
    // The packing-lists folder.
    {
      id: "fjallvandring",
      title: "Fjällvandring",
      folderId: "packlistor",
      glyph: "leaf",
      color: "#5cb39e",
      items: [
        leaf("fj-talt", "Tält"),
        leaf("fj-sovsack", "Sovsäck"),
        leaf("fj-liggunderlag", "Liggunderlag"),
        leaf("fj-stormkok", "Stormkök & gasol"),
        leaf("fj-kangor", "Vandringskängor"),
        leaf("fj-karta", "Karta & kompass"),
        {
          id: "fj-klader",
          label: "Kläder",
          checked: false,
          children: [
            leaf("fj-underställ", "Ullunderställ"),
            leaf("fj-fleece", "Fleecetröja"),
            leaf("fj-regnstall", "Regnställ"),
            leaf("fj-strumpor", "Vandringsstrumpor", true),
          ],
        },
      ],
    },
    {
      id: "charterresa",
      title: "Charterresa",
      folderId: "packlistor",
      glyph: "plane",
      color: "#61afef",
      items: [
        leaf("ch-pass", "Pass", true),
        leaf("ch-boardingkort", "Boardingkort"),
        leaf("ch-solkram", "Solkräm"),
        leaf("ch-badklader", "Badkläder"),
        leaf("ch-solglasogon", "Solglasögon"),
        leaf("ch-laddare", "Mobilladdare"),
        {
          id: "ch-necessar",
          label: "Necessär",
          checked: false,
          children: [
            leaf("ch-tandborste", "Tandborste"),
            leaf("ch-tandkram", "Tandkräm"),
            leaf("ch-deodorant", "Deodorant"),
          ],
        },
      ],
    },
    {
      id: "sommarstugan",
      title: "Sommarstugan",
      folderId: "packlistor",
      glyph: "home",
      color: "#e5c07b",
      items: [
        leaf("ss-sanglinne", "Sänglinne"),
        leaf("ss-handdukar", "Handdukar"),
        leaf("ss-myggmedel", "Myggmedel"),
        leaf("ss-tandstickor", "Tändstickor"),
      ],
    },
    {
      id: "barnens-vaska",
      title: "Barnens väska",
      folderId: "packlistor",
      glyph: "gift",
      color: "#c678dd",
      items: [
        leaf("bv-blojor", "Blöjor"),
        leaf("bv-vatservetter", "Våtservetter"),
        leaf("bv-gosedjur", "Gosedjur"),
        leaf("bv-ombyte", "Ombyte"),
        leaf("bv-regnklader", "Regnkläder"),
      ],
    },
  ],
};
