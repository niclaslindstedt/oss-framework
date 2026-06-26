// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  countProgress,
  flattenNodes,
  type ChecklistNode,
} from "@niclaslindstedt/oss-framework/checklist";

import { SEED } from "./seed.ts";
import type { AppData, Folder, List } from "./types.ts";

// The app's data store. Holds the whole document in state, persists it to
// localStorage, and exposes the edit actions the screens drive — toggling
// items, adding lists / folders / items, switching the active list — over an
// undo / redo history. This is the "store stays in the app" seam: the
// framework owns the pure tree transforms (`toggleNode`, `countProgress`, …);
// this hook owns where the data lives and how edits stack up.

const STORAGE_KEY = "oss-demo:checklist:doc";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    // Corrupt or unavailable storage — fall back to the seed.
  }
  return SEED;
}

let counter = 0;
function freshId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Count of still-unchecked nodes in a list — the side menu's row badge. */
export function remaining(list: List): number {
  return flattenNodes(list.items).filter((n) => !n.checked).length;
}

export type ChecklistStore = ReturnType<typeof useChecklistStore>;

export function useChecklistStore() {
  const [data, setData] = useState<AppData>(load);
  // Edit history. `setActive` replaces the present without pushing, so
  // navigation never clutters undo; every content edit goes through `commit`.
  const past = useRef<AppData[]>([]);
  const future = useRef<AppData[]>([]);
  const [version, setVersion] = useState(0); // re-render on history change

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full / unavailable — the in-memory state still works.
    }
  }, [data]);

  const commit = useCallback((next: AppData) => {
    setData((prev) => {
      past.current.push(prev);
      future.current = [];
      return next;
    });
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setData((cur) => {
      future.current.push(cur);
      return prev;
    });
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setData((cur) => {
      past.current.push(cur);
      return next;
    });
    setVersion((v) => v + 1);
  }, []);

  const setActive = useCallback((id: string) => {
    setData((prev) =>
      prev.activeListId === id ? prev : { ...prev, activeListId: id },
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
    addList,
    addFolder,
    undo,
    redo,
  };
}
