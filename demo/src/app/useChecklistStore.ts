// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  countProgress,
  flattenNodes,
  removeNode,
  type ChecklistNode,
} from "@niclaslindstedt/oss-framework/checklist";
import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";

import { SEED } from "./seed.ts";
import type { AppData, Folder, List } from "./types.ts";

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
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    // Corrupt or unavailable storage — fall back to the seed / a blank doc.
  }
  return slug === DEFAULT_NAMESPACE_SLUG ? SEED : emptyDoc();
}

/** Count of still-unchecked nodes in a list — the side menu's row badge. */
export function remaining(list: List): number {
  return flattenNodes(list.items).filter((n) => !n.checked).length;
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
      localStorage.setItem(docKey(state.slug), JSON.stringify(state.data));
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

  const setActive = useCallback((id: string) => {
    setState((prev) =>
      prev.data.activeListId === id
        ? prev
        : { ...prev, data: { ...prev.data, activeListId: id } },
    );
  }, []);

  // Replace the active list's items (toggles, check-all, …).
  const setActiveItems = useCallback(
    (items: ChecklistNode[]) =>
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId ? { ...l, items } : l,
        ),
      }),
    [commit, data],
  );

  const addItem = useCallback(
    (label: string) => {
      const text = label.trim();
      if (!text) return;
      const item: ChecklistNode = {
        id: freshId("item"),
        label: text,
        checked: false,
      };
      commit({
        ...data,
        lists: data.lists.map((l) =>
          l.id === data.activeListId ? { ...l, items: [...l.items, item] } : l,
        ),
      });
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

  const addList = useCallback(
    (folderId: string | null) => {
      const id = freshId("list");
      const list: List = { id, title: "Ny lista", folderId, items: [] };
      commit({ ...data, lists: [...data.lists, list], activeListId: id });
    },
    [commit, data],
  );

  const addFolder = useCallback(() => {
    const folder: Folder = { id: freshId("folder"), name: "Ny mapp" };
    commit({ ...data, folders: [...data.folders, folder] });
  }, [commit, data]);

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
      activeList ? countProgress(activeList.items) : { checked: 0, total: 0 },
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
    addList,
    addFolder,
    setListAppearance,
    reload,
    undo,
    redo,
  };
}
