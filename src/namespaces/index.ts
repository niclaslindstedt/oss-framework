// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Namespaces — named buckets (a profile, a workspace, a category) that each
// hold their own document. This module owns the *data* (the `Namespace` type
// and the pure list operations over it), the favicon resolver that re-badges
// the tab to the active namespace, and the management `NamespacesModal`. Where
// the list and the active-namespace pointer live — and how a slug maps to a
// storage location — stays in your app (see the README for the seam).

export {
  DEFAULT_NAMESPACE,
  DEFAULT_NAMESPACE_SLUG,
  isNamespace,
  normalizeNamespaces,
  parseNamespaces,
  serializeNamespaces,
  mergeNamespaceLists,
  hasLocalOnlyNamespaces,
  slugify,
  addNamespace,
  renameNamespace,
  setNamespaceAppearance,
  removeNamespace,
  type Namespace,
  type NamespaceAppearance,
} from "./namespaces.ts";
export {
  namespaceFaviconHref,
  applyFaviconHref,
  type NamespaceFaviconOptions,
} from "./favicon.ts";
export { NamespacesModal, type NamespacesLabels } from "./NamespacesModal.tsx";
export {
  NamespaceSwitcher,
  type NamespaceSwitcherLabels,
} from "./NamespaceSwitcher.tsx";
