// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  countProgress,
  flattenNodes,
  insertNode,
  removeNode,
  updateNode,
  type InsertPosition,
} from "@niclaslindstedt/oss-framework/checklist";
import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";

import {
  LATEST_VERSION,
  legacyDocument,
  migrator,
  toAppData,
} from "./migrations.ts";
import { NAMESPACE_SEEDS, SEED } from "./seed.ts";
import type { AppData, Folder, Item, List, ListKind } from "./types.ts";

// Set / clear the app's own `archived` flag on an item — the swipe-to-archive
// (and restore) outcome. The framework owns no archived concept, so the demo
// drives the generic `updateNode` with its own field; clearing deletes the flag
// so a restored item round-trips byte-for-byte. No cascade: archiving shelves a
// single item, leaving any sub-items in place.
function setItemArchived(items: Item[], id: string, archived: boolean): Item[] {
  return updateNode<Item>(items, id, (n) => {
    if (archived) return { ...n, archived: true };
    const next = { ...n };
    delete next.archived;
    return next;
  });
}

// An item is "live" (shown, counted) unless the app archived it — the predicate
// the screen hands `Checklist`/`countProgress` to drop archived rows from view.
const isArchived = (n: Item): boolean => n.archived === true;

// The app's data store. Holds one namespace's document in state, persists it to
// a per-namespace localStorage key, and exposes the edit actions the screens
// drive — toggling items, adding lists / folders / items, switching the active
// list — over an undo / redo history. This is the "store stays in the app"
// seam: the framework owns the pure tree transforms (`toggleNode`,
// `countProgress`, …) and the namespace data model; this hook owns where each
// namespace's document lives and how edits stack up.
//
// The store is keyed by the active namespace slug. Switching namespaces hands
// this hook a new slug; it adopts that namespace's document and resets the
// undo history, so each workspace keeps its own data and its own history.

const DOC_KEY_PREFIX = "oss-demo:checklist:doc";

/** localStorage key for a namespace's document. The default namespace keeps
 *  the historical un-suffixed key so an existing demo's data survives the
 *  multi-namespace upgrade; every other namespace gets a per-slug suffix. */
export function docKey(slug: string): string {
  return slug === DEFAULT_NAMESPACE_SLUG
    ? DOC_KEY_PREFIX
    : `${DOC_KEY_PREFIX}:${slug}`;
}

let counter = 0;
function freshId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** A blank starter document for a brand-new namespace — one empty list so the
 *  screen is never blank. */
function emptyDoc(): AppData {
  return {
    activeListId: "start",
    folders: [],
    lists: [{ id: "start", title: "Att göra", folderId: null, items: [] }],
  };
}

function load(slug: string): AppData {
  try {
    const raw = localStorage.getItem(docKey(slug));
    // Run the persisted bytes forward to the latest version before the app sees
    // them: a document written by an older build (or with no `version` at all)
    // upgrades through the migration chain. The version lives only on disk, so
    // the result is narrowed back to the version-free `AppData` model.
    if (raw) return toAppData(migrator.migrate(JSON.parse(raw)).data);
  } catch {
    // Corrupt or unavailable storage — fall back to the seed / a blank doc.
  }
  // Boot each namespace from its own starter document: the household `SEED` for
  // the default, a lived-in work document for the seeded work namespaces, and a
  // blank starter for any namespace the user creates themselves.
  if (slug === DEFAULT_NAMESPACE_SLUG) return SEED;
  return NAMESPACE_SEEDS[slug] ?? emptyDoc();
}

/** Write a namespace's document to its localStorage key, stamping the latest
 *  version onto the bytes (the on-disk shape carries a version; the in-memory
 *  `AppData` does not). Used to push a checklist / folder *into another
 *  namespace's* document — the one the active store isn't holding. */
function persistDoc(slug: string, doc: AppData): void {
  localStorage.setItem(
    docKey(slug),
    JSON.stringify({ version: LATEST_VERSION, ...doc }),
  );
}

/** Count of still-unchecked, live (non-archived) nodes in a list — the side
 *  menu's row badge. */
export function remaining(list: List): number {
  return flattenNodes(list.items).filter((n) => !n.checked && !n.archived)
    .length;
}

/** Pick the active list after a delete/archive: keep the current one if it's
 *  still visible, otherwise fall to the first un-archived list — so removing
 *  the open checklist never leaves the screen pointed at a gone/hidden one. */
function nextActiveId(lists: List[], current: string): string {
  if (lists.some((l) => l.id === current && !l.archived)) return current;
  return lists.find((l) => !l.archived)?.id ?? current;
}

export type ChecklistStore = ReturnType<typeof useChecklistStore>;

export function useChecklistStore(slug: string) {
  // The active slug travels *with* the document in state so the persist effect
  // can never write one namespace's data under another's key (the clobber a
  // separate `data` + `slug` state would race into on a switch).
  const [state, setState] = useState(() => ({ slug, data: load(slug) }));
  // Edit history. `setActive` replaces the present without pushing, so
  // navigation never clutters undo; every content edit goes through `commit`.
  const past = useRef<AppData[]>([]);
  const future = useRef<AppData[]>([]);
  const [version, setVersion] = useState(0); // re-render on history change

  // Namespace switch — adopt that namespace's document and reset history.
  // Adjusting state during render (rather than in an effect) is React's blessed
  // way to respond to a changed input with no stale-doc flash and no clobbered
  // save.
  if (state.slug !== slug) {
    past.current = [];
    future.current = [];
    setState({ slug, data: load(slug) });
  }

  const data = state.data;

  useEffect(() => {
    try {
      // Stamp the latest version onto the bytes at rest so the migration chain
      // stays honest — the in-memory `AppData` is version-free; the version is
      // a property of the persisted JSON only.
      localStorage.setItem(
        docKey(state.slug),
        JSON.stringify({ version: LATEST_VERSION, ...state.data }),
      );
    } catch {
      // Storage full / unavailable — the in-memory state still works.
    }
  }, [state]);

  const commit = useCallback((next: AppData) => {
    setState((prev) => {
      past.current.push(prev.data);
      future.current = [];
      return { ...prev, data: next };
    });
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setState((cur) => {
      future.current.push(cur.data);
      return { ...cur, data: prev };
    });
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setState((cur) => {
      past.current.push(cur.data);
      return { ...cur, data: next };
    });
    setVersion((v) => v + 1);
  }, []);

  // Re-read the persisted document from localStorage, picking up edits made in
  // another tab. Drives the pull-to-refresh "sync" gesture — a genuine
  // local-first refresh, not a fake spinner. Replaces the present without
  // touching the undo history (a sync isn't an edit you'd undo).
  const reload = useCallback(() => {
    setState((cur) => ({ ...cur, data: load(cur.slug) }));
    setVersion((v) => v + 1);
  }, []);

  // Drop a genuine pre-versioning (v0) document onto disk and re-read it, so the
  // migration runner climbs it to today's shape live — the Developer tab's
  // "load a legacy document" affordance. The upgrade logs a "migrated v0 → v2"
  // line into the in-app buffer the Logs tab shows. Replaces the present without
  // pushing history (it's a debug reset, not an edit you'd undo).
  const simulateLegacyDoc = useCallback(() => {
    setState((cur) => {
      try {
        localStorage.setItem(
          docKey(cur.slug),
          JSON.stringify(legacyDocument()),
        );
      } catch {
        // Unavailable storage — `load` falls back to the seed below.
      }
      past.current = [];
      future.current = [];
      return { ...cur, data: load(cur.slug) };
    });
    setVersion((v) => v + 1);
  }, []);

  const setActive = useCallback((id: string) => {
    setState((prev) =>
      prev.data.activeListId === id
        ? prev
        : { ...prev, data: { ...prev.data, activeListId: id } },
    );
  }, []);

  // Replace the active list's items (toggles, check-all, …).
  const setActiveItems = useCallback(
    (items: Item[]) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId ? { ...l, items } : l,
        ),
      }),
    [commit, data],
  );

  // Add an item to the active list at `position` (top / bottom of the list, or
  // as a sibling after a given node — the composer's "type the next row below
  // this one" flow). Returns the new node's id so the composer can re-anchor,
  // or null when the label was blank. Defaults to appending at the bottom.
  const addItem = useCallback(
    (label: string, position: InsertPosition = { at: "bottom" }) => {
      const text = label.trim();
      if (!text) return null;
      const id = freshId("item");
      const item: Item = { id, label: text, checked: false };
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId
            ? { ...l, items: insertNode(l.items, item, position) }
            : l,
        ),
      });
      return id;
    },
    [commit, data],
  );

  // Drop an item (and any sub-items) from the active list — the swipe-to-delete
  // outcome. Goes through `commit`, so an accidental flick is one Undo away.
  const deleteItem = useCallback(
    (id: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId
            ? { ...l, items: removeNode(l.items, id) }
            : l,
        ),
      }),
    [commit, data],
  );

  // Archive an item in the active list — the swipe-right outcome. Shelves it out
  // of the live list (the Archive page lists it) without dropping it; an Undo
  // brings it straight back.
  const archiveItem = useCallback(
    (id: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId
            ? { ...l, items: setItemArchived(l.items, id, true) }
            : l,
        ),
      }),
    [commit, data],
  );

  // Restore an archived item back into the list that owns it — the Archive
  // page's "restore". The list id is supplied because items restore into their
  // own list, not whichever one is active.
  const unarchiveItem = useCallback(
    (listId: string, id: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === listId
            ? { ...l, items: setItemArchived(l.items, id, false) }
            : l,
        ),
      }),
    [commit, data],
  );

  // Permanently delete an archived item from its list — the Archive page's
  // "delete". Undoable.
  const deleteArchivedItem = useCallback(
    (listId: string, id: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === listId ? { ...l, items: removeNode(l.items, id) } : l,
        ),
      }),
    [commit, data],
  );

  // Sweep every finished (checked, still-live) item in the active list — the
  // bulk actions the add FAB reveals on a long press. `archive` shelves them;
  // otherwise they're deleted outright. Both fold the per-item transform across
  // the matched ids and land as one undoable commit.
  const sweepFinished = useCallback(
    (archive: boolean) => {
      const list = data.lists.find((l) => l.id === data.activeListId);
      if (!list) return;
      const ids = flattenNodes(list.items)
        .filter((n) => n.checked && !n.archived)
        .map((n) => n.id);
      if (ids.length === 0) return;
      let items = list.items;
      for (const id of ids) {
        items = archive
          ? setItemArchived(items, id, true)
          : removeNode(items, id);
      }
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId ? { ...l, items } : l,
        ),
      });
    },
    [commit, data],
  );
  const archiveFinishedItems = useCallback(
    () => sweepFinished(true),
    [sweepFinished],
  );
  const deleteFinishedItems = useCallback(
    () => sweepFinished(false),
    [sweepFinished],
  );

  // Create a list under a user-picked title and open it, returning its id. The
  // `kind` decides what the list holds: a checklist of `items` (the default) or
  // a `note` whose Markdown lives in `body`. Like `addFolder`, the title is
  // collected inline before this fires — an empty draft never reaches the store,
  // so a list is never born unnamed.
  const addList = useCallback(
    (
      folderId: string | null,
      title: string,
      kind: ListKind = "checklist",
    ): string => {
      const id = freshId("list");
      const list: List =
        kind === "note"
          ? { id, title, folderId, kind: "note", body: "", items: [] }
          : { id, title, folderId, items: [] };
      commit({ ...data, lists: [...data.lists, list], activeListId: id });
      return id;
    },
    [commit, data],
  );

  // Replace a note's Markdown body — the live-preview editor's `onChange`.
  // Unlike a checklist edit this does *not* push to undo history (per-keystroke
  // commits would flood it); it replaces the present and bumps the edit counter
  // so the document still persists and the sync glyph still flags it dirty.
  const setListBody = useCallback((id: string, body: string) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        lists: prev.data.lists.map((l) => (l.id === id ? { ...l, body } : l)),
      },
    }));
    setVersion((v) => v + 1);
  }, []);

  // Create a folder under a user-picked name and return its id, so the caller
  // can act on the fresh folder (expand it, focus it). The name is collected
  // inline before this fires — an empty draft never reaches the store.
  const addFolder = useCallback(
    (name: string): string => {
      const id = freshId("folder");
      const folder: Folder = { id, name };
      commit({ ...data, folders: [...data.folders, folder] });
      return id;
    },
    [commit, data],
  );

  // Rename a folder. Goes through `commit`, so a rename is one Undo away.
  const renameFolder = useCallback(
    (id: string, name: string) =>
      commit({
        ...data,
        folders: data.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      }),
    [commit, data],
  );

  // Delete a folder — the swipe-left trash outcome. Its checklists aren't lost:
  // they're reparented to the root so deleting a folder never silently takes
  // its lists with it. Undoable.
  const deleteFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== id),
        lists: data.lists.map((l) =>
          l.folderId === id ? { ...l, folderId: null } : l,
        ),
      }),
    [commit, data],
  );

  // Archive a folder — the swipe-right outcome. Tucks the folder and its lists
  // out of the menu (the Archive counter tallies them); a held flag, not a
  // delete, so an Undo restores the lot.
  const archiveFolder = useCallback(
    (id: string) => {
      const lists = data.lists.map((l) =>
        l.folderId === id ? { ...l, archived: true } : l,
      );
      commit({
        ...data,
        folders: data.folders.map((f) =>
          f.id === id ? { ...f, archived: true } : f,
        ),
        lists,
        activeListId: nextActiveId(lists, data.activeListId),
      });
    },
    [commit, data],
  );

  // Restore an archived folder — the Archive page's "restore" outcome. Lifts the
  // flag off the folder and every list it holds, so the whole group reappears in
  // the menu just as it left. Undoable.
  const unarchiveFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.map((f) =>
          f.id === id ? { ...f, archived: false } : f,
        ),
        lists: data.lists.map((l) =>
          l.folderId === id ? { ...l, archived: false } : l,
        ),
      }),
    [commit, data],
  );

  // Permanently delete an archived folder — the Archive page's "delete" outcome.
  // Unlike the menu's `deleteFolder` (which keeps a live folder's lists by
  // reparenting them to the root), purging from the archive drops the folder and
  // every list under it together: they're already out of sight, and the archive
  // is the one place a checklist is meant to leave the document for good.
  // Undoable.
  const deleteArchivedFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== id),
        lists: data.lists.filter((l) => l.folderId !== id),
      }),
    [commit, data],
  );

  // Rename a checklist — the swipe-left pencil outcome. Undoable.
  const renameList = useCallback(
    (id: string, title: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) => (l.id === id ? { ...l, title } : l)),
      }),
    [commit, data],
  );

  // Delete a checklist — the swipe-left trash outcome. Drops it from the
  // document and moves the active pointer off it if it was open. Undoable.
  const deleteList = useCallback(
    (id: string) => {
      const lists = data.lists.filter((l) => l.id !== id);
      commit({
        ...data,
        lists,
        activeListId: nextActiveId(lists, data.activeListId),
      });
    },
    [commit, data],
  );

  // Archive a checklist — the swipe-right outcome. Hides it without dropping it
  // and steps the active pointer off it. Undoable.
  const archiveList = useCallback(
    (id: string) => {
      const lists = data.lists.map((l) =>
        l.id === id ? { ...l, archived: true } : l,
      );
      commit({
        ...data,
        lists,
        activeListId: nextActiveId(lists, data.activeListId),
      });
    },
    [commit, data],
  );

  // Restore an archived checklist — the Archive page's "restore" outcome. Drops
  // the `archived` flag so the list reappears in the menu, back in whichever
  // folder it came from (or at the root). Undoable; the active pointer is left
  // alone so a restore never yanks the screen onto the recovered list.
  const unarchiveList = useCallback(
    (id: string) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === id ? { ...l, archived: false } : l,
        ),
      }),
    [commit, data],
  );

  // Move a checklist into a folder (or out to the root, `null`) — the drag-and-
  // drop-into-a-folder outcome. A pure reparent within the active document;
  // goes through `commit`, so the move is one Undo away.
  const moveListToFolder = useCallback(
    (listId: string, folderId: string | null) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === listId ? { ...l, folderId } : l,
        ),
      }),
    [commit, data],
  );

  // Move a checklist into *another* namespace — dropping it onto a workspace row
  // in the side menu. The target document lives under a different localStorage
  // key (the active store doesn't hold it), so we read it, append a fresh-id
  // copy (reset to the root — the target has no matching folder), write it back,
  // and only then drop the original from the active document. The remote write
  // happens first so a storage failure aborts before anything is lost. (The
  // local removal is undoable; the cross-namespace copy is not, so an Undo
  // re-adds it here and leaves the copy over there — an accepted demo edge.)
  const moveListToNamespace = useCallback(
    (listId: string, slug: string) => {
      if (slug === state.slug) return;
      const list = data.lists.find((l) => l.id === listId);
      if (!list) return;
      try {
        const target = load(slug);
        const moved: List = { ...list, id: freshId("list"), folderId: null };
        persistDoc(slug, { ...target, lists: [...target.lists, moved] });
      } catch {
        return; // Storage unavailable — abort rather than drop the list.
      }
      const lists = data.lists.filter((l) => l.id !== listId);
      commit({
        ...data,
        lists,
        activeListId: nextActiveId(lists, data.activeListId),
      });
    },
    [commit, data, state.slug],
  );

  // Move a folder — and every checklist it holds — into another namespace.
  // Same shape as the list move: append fresh-id copies (under a fresh folder id)
  // to the target document, then drop the folder and its lists from the active
  // one. Carries archived lists along too, so none are orphaned under a folder
  // id that no longer exists.
  const moveFolderToNamespace = useCallback(
    (folderId: string, slug: string) => {
      if (slug === state.slug) return;
      const folder = data.folders.find((f) => f.id === folderId);
      if (!folder) return;
      const folderLists = data.lists.filter((l) => l.folderId === folderId);
      try {
        const target = load(slug);
        const newFolderId = freshId("folder");
        const movedFolder: Folder = { ...folder, id: newFolderId };
        const movedLists: List[] = folderLists.map((l) => ({
          ...l,
          id: freshId("list"),
          folderId: newFolderId,
        }));
        persistDoc(slug, {
          ...target,
          folders: [...target.folders, movedFolder],
          lists: [...target.lists, ...movedLists],
        });
      } catch {
        return; // Storage unavailable — abort rather than drop the folder.
      }
      const movedIds = new Set(folderLists.map((l) => l.id));
      const lists = data.lists.filter((l) => !movedIds.has(l.id));
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== folderId),
        lists,
        activeListId: nextActiveId(lists, data.activeListId),
      });
    },
    [commit, data, state.slug],
  );

  // Set a list's appearance — the glyph and/or accent colour the framework's
  // `/glyphs` pickers feed. A partial patch so the colour and the icon can be
  // changed independently; goes through `commit`, so a restyle is undoable.
  const setListAppearance = useCallback(
    (id: string, patch: { glyph?: string | null; color?: string | null }) =>
      commit({
        ...data,
        lists: data.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }),
    [commit, data],
  );

  const activeList = useMemo(
    () => data.lists.find((l) => l.id === data.activeListId) ?? data.lists[0],
    [data],
  );

  const progress = useMemo(
    () =>
      activeList
        ? countProgress(activeList.items, isArchived)
        : { checked: 0, total: 0 },
    [activeList],
  );

  return {
    data,
    activeList,
    progress,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
    setActive,
    setActiveItems,
    addItem,
    deleteItem,
    archiveItem,
    unarchiveItem,
    deleteArchivedItem,
    archiveFinishedItems,
    deleteFinishedItems,
    addList,
    setListBody,
    addFolder,
    renameFolder,
    deleteFolder,
    archiveFolder,
    unarchiveFolder,
    deleteArchivedFolder,
    renameList,
    deleteList,
    archiveList,
    unarchiveList,
    moveListToFolder,
    moveListToNamespace,
    moveFolderToNamespace,
    setListAppearance,
    reload,
    simulateLegacyDoc,
    undo,
    redo,
  };
}
