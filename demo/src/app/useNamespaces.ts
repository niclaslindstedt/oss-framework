// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import {
  DEFAULT_NAMESPACE_SLUG,
  addNamespace,
  normalizeNamespaces,
  parseNamespaces,
  removeNamespace,
  renameNamespace,
  serializeNamespaces,
  setNamespaceAppearance,
  type Namespace,
  type NamespaceAppearance,
} from "@niclaslindstedt/oss-framework/namespaces";

import { docKey } from "./useChecklistStore.ts";

// The app's namespace registry — the "store stays in the app" seam for the
// `namespaces` module. The framework owns the `Namespace` shape and the pure
// list transforms; this hook owns *where* the list and the active-namespace
// pointer live (two localStorage keys) and how a slug maps to a document key
// (delegated to `useChecklistStore`'s `docKey`). Switching a namespace just
// changes the active slug — the document store keys off it and swaps the doc.

const LIST_KEY = "oss-demo:checklist:namespaces";
const ACTIVE_KEY = "oss-demo:checklist:namespace:active";

// First-run registry: a renamed default ("Privat") plus a second workspace
// ("Jobb") so the switcher is meaningful out of the box. The default keeps the
// reserved `default` slug, so its document is the seeded household lists; Jobb
// starts from an empty starter document (see `useChecklistStore`).
const SEED_NAMESPACES: Namespace[] = normalizeNamespaces([
  { slug: DEFAULT_NAMESPACE_SLUG, name: "Privat" },
  { slug: "jobb", name: "Jobb", glyph: "briefcase", color: "#61afef" },
]);

function loadList(): Namespace[] {
  const raw = localStorage.getItem(LIST_KEY);
  if (raw === null) return SEED_NAMESPACES;
  return parseNamespaces(raw);
}

function loadActive(list: Namespace[]): string {
  const slug = localStorage.getItem(ACTIVE_KEY);
  if (slug && list.some((n) => n.slug === slug)) return slug;
  return DEFAULT_NAMESPACE_SLUG;
}

export type NamespacesStore = ReturnType<typeof useNamespaces>;

export function useNamespaces() {
  const [list, setList] = useState<Namespace[]>(loadList);
  const [activeSlug, setActiveSlug] = useState<string>(() => loadActive(list));

  const switchTo = useCallback((slug: string) => {
    localStorage.setItem(ACTIVE_KEY, slug);
    setActiveSlug(slug);
  }, []);

  const create = useCallback(
    (name: string, appearance?: NamespaceAppearance) => {
      setList((cur) => {
        const { list: withNew, created } = addNamespace(cur, name);
        const next = appearance
          ? setNamespaceAppearance(withNew, created.slug, appearance)
          : withNew;
        localStorage.setItem(LIST_KEY, serializeNamespaces(next));
        switchTo(created.slug);
        return next;
      });
    },
    [switchTo],
  );

  const rename = useCallback(
    (slug: string, name: string) =>
      setList((cur) => {
        const next = renameNamespace(cur, slug, name);
        localStorage.setItem(LIST_KEY, serializeNamespaces(next));
        return next;
      }),
    [],
  );

  const setAppearance = useCallback(
    (slug: string, patch: NamespaceAppearance) =>
      setList((cur) => {
        const next = setNamespaceAppearance(cur, slug, patch);
        localStorage.setItem(LIST_KEY, serializeNamespaces(next));
        return next;
      }),
    [],
  );

  // Removing a namespace drops it from the registry *and* deletes its document
  // (the framework only edits the list — destroying the data is the app's job,
  // exactly as the module README spells out). If it was active, fall back to
  // the default.
  const remove = useCallback(
    (slug: string) => {
      setList((cur) => {
        const next = removeNamespace(cur, slug);
        localStorage.setItem(LIST_KEY, serializeNamespaces(next));
        return next;
      });
      try {
        localStorage.removeItem(docKey(slug));
      } catch {
        // Storage unavailable — the registry edit above still stands.
      }
      setActiveSlug((cur) => (cur === slug ? DEFAULT_NAMESPACE_SLUG : cur));
      if (activeSlug === slug) {
        localStorage.setItem(ACTIVE_KEY, DEFAULT_NAMESPACE_SLUG);
      }
    },
    [activeSlug],
  );

  const activeNamespace = list.find((n) => n.slug === activeSlug) ?? list[0]!;

  return {
    list,
    activeSlug,
    activeNamespace,
    switchTo,
    create,
    rename,
    setAppearance,
    remove,
  };
}
