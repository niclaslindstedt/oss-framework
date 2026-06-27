// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  CheckIcon,
  ChecklistIcon,
  FolderIcon,
  PaletteIcon,
  PlusIcon,
  SlidersIcon,
  SparklesIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  flattenNodes,
  type ChecklistNode,
} from "@niclaslindstedt/oss-framework/checklist";
import type { Achievement } from "@niclaslindstedt/oss-framework/achievements";

import type { AppData } from "./types.ts";

// The demo's achievement catalog — the "store stays in the app" half of the
// framework's achievements module. The framework owns the engine, the bus, and
// the trophy UI; this file owns *which* of the app's features are trophies and
// how each one unlocks. The watched state is the whole checklist document.
//
// Display copy lives inline on each entry (this demo is English-only); an i18n
// app would fill `name` / `condition` / `learnMore` from its translator here.

// The state a derived predicate inspects. The watcher is generic over this;
// here it's simply the app document.
export type AchState = AppData;

// An empty baseline, used once on first run to retroactively award the trophies
// the seeded document already satisfies (see `useAchievements`).
export const EMPTY_STATE: AchState = {
  folders: [],
  lists: [],
  activeListId: "",
};

// --- predicate helpers -----------------------------------------------------

const someRaw = (
  nodes: readonly ChecklistNode[],
  pred: (n: ChecklistNode) => boolean,
): boolean =>
  nodes.some(
    (n) => pred(n) || (n.children ? someRaw(n.children, pred) : false),
  );

const hasAnyItem = (d: AchState) => d.lists.some((l) => l.items.length > 0);
const hasChecked = (d: AchState) =>
  d.lists.some((l) => someRaw(l.items, (n) => n.checked));
const hasNested = (d: AchState) =>
  d.lists.some((l) => someRaw(l.items, (n) => (n.children?.length ?? 0) > 0));
const hasFolder = (d: AchState) => d.folders.length > 0;
const manyLists = (d: AchState) => d.lists.length > 1;
const hasStyled = (d: AchState) =>
  d.lists.some((l) => Boolean(l.glyph) || Boolean(l.color));
const anyFullyChecked = (d: AchState) =>
  d.lists.some((l) => {
    const flat = flattenNodes(l.items);
    return flat.length > 0 && flat.every((n) => n.checked);
  });

// A derived entry fires when its predicate flips false → true across an edit.
const derived = (
  pred: (d: AchState) => boolean,
  slice: (d: AchState) => unknown,
) =>
  ({
    kind: "derived",
    slices: (d: AchState) => [slice(d)],
    predicate: (p: AchState, n: AchState) => !pred(p) && pred(n),
  }) as const;

export const CATALOG: readonly Achievement<AchState>[] = [
  // ── Beginner ──────────────────────────────────────────────────────────
  {
    id: "firstSteps",
    tier: "beginner",
    glyph: PlusIcon,
    name: "First Steps",
    condition: "Add your first item.",
    learnMore:
      "Tap the add button, type a task, press Enter. That single item is the loop the whole app is built around.",
    trigger: derived(hasAnyItem, (d) => d.lists),
  },
  {
    id: "checkItOff",
    tier: "beginner",
    glyph: CheckIcon,
    name: "Check, Please",
    condition: "Tick an item off.",
    trigger: derived(hasChecked, (d) => d.lists),
  },
  // ── Intermediate ──────────────────────────────────────────────────────
  {
    id: "collector",
    tier: "intermediate",
    glyph: ChecklistIcon,
    name: "Collector",
    condition: "Keep more than one list.",
    trigger: derived(manyLists, (d) => d.lists),
  },
  {
    id: "filingSystem",
    tier: "intermediate",
    glyph: FolderIcon,
    name: "Filing System",
    condition: "Create a folder.",
    trigger: derived(hasFolder, (d) => d.folders),
  },
  // ── Pro ───────────────────────────────────────────────────────────────
  {
    id: "madeItYours",
    tier: "pro",
    glyph: PaletteIcon,
    name: "Made It Yours",
    condition: "Give a list an icon or colour.",
    learnMore:
      "Open a list's appearance popover from its header and pick a glyph or accent — the menu icon and the browser tab follow it.",
    trigger: derived(hasStyled, (d) => d.lists),
  },
  {
    id: "cleanSweep",
    tier: "pro",
    glyph: SparklesIcon,
    name: "Clean Sweep",
    condition: "Check off every item in a list.",
    trigger: derived(anyFullyChecked, (d) => d.lists),
  },
  // ── Expert ────────────────────────────────────────────────────────────
  {
    id: "powerUser",
    tier: "expert",
    glyph: SlidersIcon,
    name: "Power User",
    condition: "Nest an item under another.",
    trigger: derived(hasNested, (d) => d.lists),
  },
  {
    id: "timeTraveler",
    tier: "expert",
    glyph: UndoIcon,
    name: "Time Traveler",
    condition: "Undo a change.",
    // Undo lives outside the document state, so it fires through the manual bus.
    trigger: { kind: "manual" },
  },
];
