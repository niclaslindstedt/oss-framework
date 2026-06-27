// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChecklistNode } from "@niclaslindstedt/oss-framework/checklist";

// The demo app's domain types. The framework owns the generic `ChecklistNode`
// (a checkable tree node); the app layers its own concerns — a list has a
// title and lives in a folder (or stands alone), folders group lists, and a
// namespace is the top-level workspace. This is exactly the seam the framework
// describes: it owns the tree mechanics and the look; the app owns the domain
// shape and where the data lives.

/** A single checklist: a titled tree of items, optionally inside a folder. */
export type List = {
  id: string;
  title: string;
  // `null` for a standalone (ungrouped) list shown at the menu's root.
  folderId: string | null;
  items: ChecklistNode[];
  // The list's appearance — a glyph name (from the framework's catalogue) and
  // an accent colour. `null`/absent means "no custom icon" (the default glyph)
  // and "no accent". This is the app owning *where the choice lives*; the
  // framework's `/glyphs` kit owns the catalogue, the renderer, and the pickers.
  glyph?: string | null;
  color?: string | null;
  // Set when the list is archived (swiped right in the side menu). Archived
  // lists stay in the document — they drop out of the menu but the Archive
  // counter tallies them and an Undo brings them back.
  archived?: boolean;
};

/** A folder groups lists in the side menu under one collapsible row. */
export type Folder = {
  id: string;
  name: string;
  // Set when the folder is archived; archiving a folder archives its lists with
  // it. Like a list's flag, it hides the row without dropping the data.
  archived?: boolean;
};

/** The whole app document — one namespace's folders and lists. Which
 *  namespace this document belongs to is the registry's concern (see
 *  `useNamespaces`), so the document itself carries no namespace identity. */
export type AppData = {
  folders: Folder[];
  lists: List[];
  activeListId: string;
};
