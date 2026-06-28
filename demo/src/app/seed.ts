// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

import type { AppData } from "./types.ts";

// The starting document the demo boots with — realistic shopping and packing
// lists for an ordinary household. The active list is the weekly grocery run
// ("Weekly groceries"); the "Packing lists" folder groups the family's
// recurring packing lists (a mountain hike, a beach holiday, the summer cabin,
// the kids' bag), a couple of which nest a sub-list to show the tree depth. A
// second standalone list rounds out the menu. Each list carries a `glyph` +
// `color` from the framework's `/glyphs` catalogue, so the side-menu icons and
// the tab favicon read in the list's own colour out of the box.
//
// `checkedAt` stamps use a fixed timestamp so the "sort checked to the bottom"
// order is deterministic across reloads (no wall-clock in the seed).

const leaf = (id: string, label: string, checked = false): ChecklistNode =>
  checked
    ? { id, label, checked, checkedAt: `2024-01-01T00:00:00.000Z` }
    : { id, label, checked };

export const SEED: AppData = {
  activeListId: "groceries",
  folders: [{ id: "packing", name: "Packing lists" }],
  lists: [
    // A short standalone shopping list — sits above the active one in the menu.
    {
      id: "pharmacy",
      title: "Pharmacy",
      folderId: null,
      glyph: "heart",
      color: "#e06c75",
      items: [
        leaf("ph-paracetamol", "Paracetamol"),
        leaf("ph-plasters", "Plasters"),
        leaf("ph-nasal-spray", "Nasal spray"),
        leaf("ph-sunscreen", "Sunscreen SPF 30"),
      ],
    },
    // The active list — the weekly grocery run.
    {
      id: "groceries",
      title: "Weekly groceries",
      folderId: null,
      glyph: "cart",
      color: "#98c379",
      items: [
        leaf("gr-milk", "Milk (1.5%)"),
        leaf("gr-buttermilk", "Buttermilk"),
        leaf("gr-butter", "Butter"),
        leaf("gr-eggs", "Eggs"),
        leaf("gr-crispbread", "Crispbread"),
        leaf("gr-coffee", "Filter coffee"),
        leaf("gr-bananas", "Bananas"),
        leaf("gr-cucumber", "Cucumber"),
        leaf("gr-carrots", "Carrots"),
        leaf("gr-meatballs", "Meatballs"),
        leaf("gr-pasta", "Pasta"),
        leaf("gr-tomatoes", "Crushed tomatoes"),
        leaf("gr-onion", "Yellow onion"),
        leaf("gr-cheese", "Mature cheese"),
        leaf("gr-toilet-paper", "Toilet paper", true),
        leaf("gr-dish-soap", "Dish soap", true),
      ],
    },
    // The packing-lists folder.
    {
      id: "hike",
      title: "Mountain hike",
      folderId: "packing",
      glyph: "leaf",
      color: "#5cb39e",
      items: [
        leaf("hk-tent", "Tent"),
        leaf("hk-sleeping-bag", "Sleeping bag"),
        leaf("hk-sleeping-pad", "Sleeping pad"),
        leaf("hk-stove", "Camping stove & gas"),
        leaf("hk-boots", "Hiking boots"),
        leaf("hk-map", "Map & compass"),
        {
          id: "hk-clothes",
          label: "Clothes",
          checked: false,
          children: [
            leaf("hk-base-layer", "Wool base layer"),
            leaf("hk-fleece", "Fleece jacket"),
            leaf("hk-rain-gear", "Rain gear"),
            leaf("hk-socks", "Hiking socks", true),
          ],
        },
      ],
    },
    {
      id: "beach",
      title: "Beach holiday",
      folderId: "packing",
      glyph: "plane",
      color: "#61afef",
      items: [
        leaf("bh-passport", "Passport", true),
        leaf("bh-boarding-pass", "Boarding pass"),
        leaf("bh-sunscreen", "Sunscreen"),
        leaf("bh-swimwear", "Swimwear"),
        leaf("bh-sunglasses", "Sunglasses"),
        leaf("bh-charger", "Phone charger"),
        {
          id: "bh-toiletries",
          label: "Toiletry bag",
          checked: false,
          children: [
            leaf("bh-toothbrush", "Toothbrush"),
            leaf("bh-toothpaste", "Toothpaste"),
            leaf("bh-deodorant", "Deodorant"),
          ],
        },
      ],
    },
    {
      id: "cabin",
      title: "Summer cabin",
      folderId: "packing",
      glyph: "home",
      color: "#e5c07b",
      items: [
        leaf("cb-bed-linen", "Bed linen"),
        leaf("cb-towels", "Towels"),
        leaf("cb-bug-spray", "Bug spray"),
        leaf("cb-matches", "Matches"),
      ],
    },
    {
      id: "kids-bag",
      title: "Kids' bag",
      folderId: "packing",
      glyph: "gift",
      color: "#c678dd",
      items: [
        leaf("kb-diapers", "Diapers"),
        leaf("kb-wet-wipes", "Wet wipes"),
        leaf("kb-stuffed-animal", "Stuffed animal"),
        leaf("kb-spare-clothes", "Change of clothes"),
        leaf("kb-rain-clothes", "Rain clothes"),
      ],
    },
    // A standalone note — the live-preview Markdown editor's home in the demo.
    // A `note` list stores a Markdown `body` instead of checklist `items`;
    // opening it swaps the checklist screen for the editor.
    {
      id: "note-recipe",
      title: "Pancake batter",
      folderId: null,
      kind: "note",
      glyph: "book",
      color: "#e5c07b",
      items: [],
      body: [
        "# Pancake batter",
        "",
        "A simple batter for **Friday pancakes** — enough for the whole family.",
        "",
        "## Ingredients",
        "",
        "- 3 dl plain flour",
        "- 6 dl milk",
        "- 3 eggs",
        "- 1 pinch of salt",
        "- 2 tbsp butter for frying",
        "",
        "## Method",
        "",
        "1. Whisk the flour and *half* the milk until smooth.",
        "2. Stir in the rest of the milk, the eggs and the salt.",
        "3. Let the batter rest for ~30 min.",
        "",
        "> Tip: fry in plenty of butter for crispy edges.",
        "",
        "More inspiration: https://www.bbcgoodfood.com/recipes",
      ].join("\n"),
    },
  ],
};

// The "Work" workspace — the everyday office namespace. The active list is the
// week's task board ("To do this week"); a quick-capture inbox sits below it,
// and the "Meetings" folder groups the recurring meeting agendas (standup,
// sprint planning, retro) so the switcher lands on a workspace that already
// looks lived-in rather than the blank starter document.
const WORK: AppData = {
  activeListId: "work-week",
  folders: [{ id: "work-meetings", name: "Meetings" }],
  lists: [
    // The active list — this week's task board.
    {
      id: "work-week",
      title: "To do this week",
      folderId: null,
      glyph: "flag",
      color: "#61afef",
      items: [
        leaf("ww-report", "Send the quarterly report to management"),
        leaf("ww-pr", "Review pull request #482"),
        leaf("ww-demo", "Book a room for the sprint demo"),
        leaf("ww-plan", "Update the project plan in Jira"),
        leaf("ww-budget", "Reconcile the budget with finance"),
        leaf("ww-quote", "Reply to the quote request", true),
        leaf("ww-timesheet", "Fill in the timesheet", true),
      ],
    },
    // Quick-capture inbox — the loose ends to triage.
    {
      id: "work-inbox",
      title: "Inbox",
      folderId: null,
      glyph: "bell",
      color: "#e5c07b",
      items: [
        leaf("wi-invoice", "Call the supplier about the invoice"),
        leaf("wi-policy", "Read through the new IT policy"),
        leaf("wi-laptop", "Order a laptop for the new hire"),
        leaf("wi-receipts", "Upload receipts to the expense system"),
      ],
    },
    // The recurring-meeting agendas.
    {
      id: "work-standup",
      title: "Standup",
      folderId: "work-meetings",
      glyph: "users",
      color: "#98c379",
      items: [
        leaf("ws-yesterday", "What did I do yesterday?"),
        leaf("ws-today", "What am I doing today?"),
        leaf("ws-blockers", "Any blockers?"),
      ],
    },
    {
      id: "work-sprint",
      title: "Sprint planning",
      folderId: "work-meetings",
      glyph: "calendar",
      color: "#61afef",
      items: [
        leaf("wsp-backlog", "Go through the backlog"),
        leaf("wsp-estimate", "Estimate stories"),
        leaf("wsp-goal", "Set the sprint goal"),
        leaf("wsp-assign", "Assign tasks"),
        {
          id: "wsp-risks",
          label: "Risks to watch",
          checked: false,
          children: [
            leaf("wsp-dependency", "Dependency on an external API"),
            leaf("wsp-vacation", "Half the team on vacation in week 29"),
          ],
        },
      ],
    },
    {
      id: "work-retro",
      title: "Retro",
      folderId: "work-meetings",
      glyph: "star",
      color: "#c678dd",
      items: [
        leaf("wr-good", "What went well?"),
        leaf("wr-better", "What could be better?"),
        leaf("wr-actions", "Actions for next sprint"),
      ],
    },
  ],
};

// The "Client work" workspace — a single client engagement. The active list is
// the running delivery board; the "Phases" folder walks the engagement from
// discovery through development to handover, so the project's whole arc reads
// in one switch.
const CLIENT: AppData = {
  activeListId: "client-delivery",
  folders: [{ id: "client-phases", name: "Phases" }],
  lists: [
    {
      id: "client-delivery",
      title: "To deliver",
      folderId: null,
      glyph: "flag",
      color: "#c678dd",
      items: [
        leaf("cd-spec", "Write the requirements spec"),
        leaf("cd-test-env", "Set up the test environment"),
        leaf("cd-demo", "Demo for the client on Friday"),
        leaf("cd-contract", "Sign the contract addendum"),
        leaf("cd-invoice", "Invoice for March", true),
      ],
    },
    {
      id: "client-discovery",
      title: "Discovery",
      folderId: "client-phases",
      glyph: "book",
      color: "#5cb39e",
      items: [
        leaf("cdi-interview", "Interview stakeholders", true),
        leaf("cdi-current", "Map the current state", true),
        leaf("cdi-report", "Compile the discovery report"),
      ],
    },
    {
      id: "client-build",
      title: "Development",
      folderId: "client-phases",
      glyph: "pen",
      color: "#61afef",
      items: [
        leaf("cb-cicd", "Set up CI/CD"),
        leaf("cb-login", "Implement login"),
        {
          id: "cb-payments",
          label: "Build the payment flow",
          checked: false,
          children: [
            leaf("cb-checkout", "Checkout page"),
            leaf("cb-email-receipt", "Email receipt"),
            leaf("cb-refunds", "Refunds"),
          ],
        },
      ],
    },
    {
      id: "client-handover",
      title: "Handover",
      folderId: "client-phases",
      glyph: "gift",
      color: "#e5c07b",
      items: [
        leaf("ch-ops-docs", "Write the operations docs"),
        leaf("ch-training", "Train the client's staff"),
        leaf("ch-closing", "Book the closing meeting"),
      ],
    },
  ],
};

// The "Business trip" workspace — prepping and running a business trip. The
// active list is the bag itself; "Preparations" covers the bookings, and "On
// site" is the day's run of meetings once you land.
const TRAVEL: AppData = {
  activeListId: "travel-bag",
  folders: [],
  lists: [
    {
      id: "travel-bag",
      title: "Packing list",
      folderId: null,
      glyph: "briefcase",
      color: "#e5c07b",
      items: [
        leaf("tb-laptop", "Laptop & charger"),
        leaf("tb-access-card", "Access card"),
        leaf("tb-business-cards", "Business cards"),
        leaf("tb-adapter", "Travel adapter"),
        leaf("tb-slides", "Presentation materials", true),
      ],
    },
    {
      id: "travel-prep",
      title: "Preparations",
      folderId: null,
      glyph: "calendar",
      color: "#61afef",
      items: [
        leaf("tp-tickets", "Book train/flight", true),
        leaf("tp-hotel", "Book a hotel", true),
        leaf("tp-expenses", "Prepare the expense report paperwork"),
        leaf("tp-confirm", "Confirm the meeting with the partner"),
      ],
    },
    {
      id: "travel-onsite",
      title: "On site",
      folderId: null,
      glyph: "pin",
      color: "#e06c75",
      items: [
        leaf("to-visit", "Client visit at 10"),
        leaf("to-lunch", "Lunch with the team"),
        leaf("to-contract", "Sign the contract"),
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
  work: WORK,
  client: CLIENT,
  travel: TRAVEL,
};
