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

// The "Jobb" workspace — the everyday office namespace. The active list is the
// week's task board ("Att göra denna vecka"); a quick-capture inbox sits below
// it, and the "Möten" folder groups the recurring meeting agendas (standup,
// sprint planning, retro) so the switcher lands on a workspace that already
// looks lived-in rather than the blank starter document.
const JOBB: AppData = {
  activeListId: "jobb-vecka",
  folders: [{ id: "jobb-moten", name: "Möten" }],
  lists: [
    // The active list — this week's task board.
    {
      id: "jobb-vecka",
      title: "Att göra denna vecka",
      folderId: null,
      glyph: "flag",
      color: "#61afef",
      items: [
        leaf("jv-rapport", "Skicka kvartalsrapport till ledningen"),
        leaf("jv-pr", "Granska pull request #482"),
        leaf("jv-demo", "Boka rum för sprintdemo"),
        leaf("jv-plan", "Uppdatera projektplanen i Jira"),
        leaf("jv-budget", "Stäm av budget med ekonomi"),
        leaf("jv-offert", "Svara på offertförfrågan", true),
        leaf("jv-tidrapport", "Fyll i tidrapporten", true),
      ],
    },
    // Quick-capture inbox — the loose ends to triage.
    {
      id: "jobb-inkorg",
      title: "Inkorg",
      folderId: null,
      glyph: "bell",
      color: "#e5c07b",
      items: [
        leaf("ji-faktura", "Ring leverantören om fakturan"),
        leaf("ji-policy", "Läs igenom nya IT-policyn"),
        leaf("ji-laptop", "Beställ laptop till nyanställd"),
        leaf("ji-kvitto", "Ladda upp kvitton i utläggssystemet"),
      ],
    },
    // The recurring-meeting agendas.
    {
      id: "jobb-standup",
      title: "Standup",
      folderId: "jobb-moten",
      glyph: "users",
      color: "#98c379",
      items: [
        leaf("js-igar", "Vad gjorde jag igår?"),
        leaf("js-idag", "Vad gör jag idag?"),
        leaf("js-hinder", "Några hinder?"),
      ],
    },
    {
      id: "jobb-sprint",
      title: "Sprintplanering",
      folderId: "jobb-moten",
      glyph: "calendar",
      color: "#61afef",
      items: [
        leaf("jsp-backlog", "Gå igenom backloggen"),
        leaf("jsp-estimera", "Estimera stories"),
        leaf("jsp-mal", "Sätt sprintmål"),
        leaf("jsp-fordela", "Fördela uppgifter"),
        {
          id: "jsp-risker",
          label: "Risker att bevaka",
          checked: false,
          children: [
            leaf("jsp-beroende", "Beroende på externt API"),
            leaf("jsp-semester", "Halva teamet på semester v.29"),
          ],
        },
      ],
    },
    {
      id: "jobb-retro",
      title: "Retro",
      folderId: "jobb-moten",
      glyph: "star",
      color: "#c678dd",
      items: [
        leaf("jr-bra", "Vad gick bra?"),
        leaf("jr-battre", "Vad kan bli bättre?"),
        leaf("jr-atgarder", "Åtgärder till nästa sprint"),
      ],
    },
  ],
};

// The "Kunduppdrag" workspace — a single client engagement. The active list is
// the running delivery board; the "Faser" folder walks the engagement from
// förstudie through utveckling to överlämning, so the project's whole arc reads
// in one switch.
const KUNDUPPDRAG: AppData = {
  activeListId: "ku-leverans",
  folders: [{ id: "ku-faser", name: "Faser" }],
  lists: [
    {
      id: "ku-leverans",
      title: "Att leverera",
      folderId: null,
      glyph: "flag",
      color: "#c678dd",
      items: [
        leaf("kl-kravspec", "Skriv kravspecifikation"),
        leaf("kl-testmiljo", "Sätt upp testmiljö"),
        leaf("kl-demo", "Demo för kund på fredag"),
        leaf("kl-avtal", "Signera avtalstillägget"),
        leaf("kl-faktura", "Fakturera mars", true),
      ],
    },
    {
      id: "ku-forstudie",
      title: "Förstudie",
      folderId: "ku-faser",
      glyph: "book",
      color: "#5cb39e",
      items: [
        leaf("kf-intervju", "Intervjua intressenter", true),
        leaf("kf-nulage", "Kartlägg nuläget", true),
        leaf("kf-rapport", "Sammanställ förstudierapport"),
      ],
    },
    {
      id: "ku-utveckling",
      title: "Utveckling",
      folderId: "ku-faser",
      glyph: "pen",
      color: "#61afef",
      items: [
        leaf("kut-cicd", "Sätt upp CI/CD"),
        leaf("kut-inlogg", "Implementera inloggning"),
        {
          id: "kut-betalflode",
          label: "Bygg betalflödet",
          checked: false,
          children: [
            leaf("kut-checkout", "Kassasida"),
            leaf("kut-kvitto", "Kvitto via e-post"),
            leaf("kut-aterbetalning", "Återbetalning"),
          ],
        },
      ],
    },
    {
      id: "ku-overlamning",
      title: "Överlämning",
      folderId: "ku-faser",
      glyph: "gift",
      color: "#e5c07b",
      items: [
        leaf("ko-dokumentation", "Skriv driftdokumentation"),
        leaf("ko-utbildning", "Utbilda kundens personal"),
        leaf("ko-slutmote", "Boka slutmöte"),
      ],
    },
  ],
};

// The "Tjänsteresa" workspace — prepping and running a business trip. The
// active list is the bag itself; "Förberedelser" covers the bookings, and "På
// plats" is the day's run of meetings once you land.
const TJANSTERESA: AppData = {
  activeListId: "tr-packlista",
  folders: [],
  lists: [
    {
      id: "tr-packlista",
      title: "Packlista",
      folderId: null,
      glyph: "briefcase",
      color: "#e5c07b",
      items: [
        leaf("tp-laptop", "Laptop & laddare"),
        leaf("tp-passerkort", "Passerkort"),
        leaf("tp-visitkort", "Visitkort"),
        leaf("tp-adapter", "Reseadapter"),
        leaf("tp-material", "Presentationsmaterial", true),
      ],
    },
    {
      id: "tr-forberedelser",
      title: "Förberedelser",
      folderId: null,
      glyph: "calendar",
      color: "#61afef",
      items: [
        leaf("tf-resa", "Boka tåg/flyg", true),
        leaf("tf-hotell", "Boka hotell", true),
        leaf("tf-reserakning", "Förbered underlag till reseräkning"),
        leaf("tf-mote", "Bekräfta mötet med partnern"),
      ],
    },
    {
      id: "tr-plats",
      title: "På plats",
      folderId: null,
      glyph: "pin",
      color: "#e06c75",
      items: [
        leaf("tpl-kundbesok", "Kundbesök kl. 10"),
        leaf("tpl-lunch", "Lunch med teamet"),
        leaf("tpl-kontrakt", "Signera kontraktet"),
      ],
    },
  ],
};

// Per-namespace starter documents, keyed by slug. The default namespace keeps
// the household `SEED` (wired directly in `useChecklistStore`); every slug here
// boots with its own lived-in document instead of the blank starter, so the
// namespace switcher is worth opening from the first run. A slug with no entry
// falls back to the empty starter document.
export const NAMESPACE_SEEDS: Record<string, AppData> = {
  jobb: JOBB,
  kunduppdrag: KUNDUPPDRAG,
  tjansteresa: TJANSTERESA,
};
