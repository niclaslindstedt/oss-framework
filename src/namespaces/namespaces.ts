// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The namespace data model and the pure list operations over it. A namespace
// is a named bucket — a profile, a workspace, a category — that holds its own
// document: switching the active namespace swaps which document your app reads
// and writes, so (say) a personal set and a shared one can sit side by side
// without one bleeding into the other.
//
// This module is deliberately storage-free. Every function here is a pure
// transform over an immutable `Namespace[]`: it takes a list and returns a new
// list (or a derived value), and never touches `localStorage`, a file backend,
// the favicon, or React. *Where* the list and the active-namespace pointer
// live — and how a slug maps to a concrete storage location (a localStorage
// key, a cloud folder) — is your app's decision, because those are coupled to
// the backend you chose and the keys your existing data already sits under.
// Keep that registry/store in your app and drive it with these helpers; see
// the module README for the seam.
//
// The slug is fixed at creation and is what every storage location should be
// derived from; the display `name` is editable and never moves data. That
// keeps a rename a cheap label change rather than a cross-backend folder move.

export type Namespace = {
  /**
   * Folder-/key-safe identifier, fixed at creation. The stable handle your
   * storage layer derives a location from (a localStorage key, a cloud
   * folder). Never changes once allocated — renaming only touches `name`.
   */
  slug: string;
  /** User-facing display name. Editable; does not move stored data. */
  name: string;
  /**
   * Optional icon the user picked for this namespace: the name of a glyph in
   * the `glyphs` catalogue (`GLYPH_NAMES`). When set, it tints the
   * namespace's row in a menu and can re-badge the favicon while the
   * namespace is active. Typed as a bare `string` so this data layer stays
   * free of any UI dependency; validate it against the known glyph set
   * (`isGlyphName`) at the UI edge.
   */
  glyph?: string;
  /**
   * Optional accent colour (any CSS colour string). Tints the namespace's
   * glyph and favicon. Independent of `glyph`: a colour with no glyph still
   * tints the default icon.
   */
  color?: string;
};

/** A partial appearance change — set a field to a value, or `null` to clear it. */
export type NamespaceAppearance = {
  glyph?: string | null;
  color?: string | null;
};

export const DEFAULT_NAMESPACE_SLUG = "default";

export const DEFAULT_NAMESPACE: Namespace = {
  slug: DEFAULT_NAMESPACE_SLUG,
  name: "Default",
};

// Longest slug `slugify` mints by default. Long enough to stay readable as a
// folder name, short enough to keep cloud paths well within backend limits.
const DEFAULT_MAX_SLUG_LENGTH = 48;

/** Type guard: a parsed value is a structurally valid `Namespace`. */
export function isNamespace(value: unknown): value is Namespace {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as Namespace).slug !== "string" ||
    typeof (value as Namespace).name !== "string" ||
    (value as Namespace).slug.length === 0
  ) {
    return false;
  }
  // Appearance fields are optional; reject only a present-but-wrong type so a
  // corrupt entry can't smuggle a non-string glyph/colour through.
  const { glyph, color } = value as Namespace;
  if (glyph !== undefined && typeof glyph !== "string") return false;
  if (color !== undefined && typeof color !== "string") return false;
  return true;
}

/**
 * Coerce any parsed value into a clean namespace list: drop non-namespace
 * entries, collapse duplicate slugs to the first seen, and materialise the
 * default namespace at the front (preserving a custom display name it was
 * given). The single normaliser every reader/parser funnels through, so they
 * all apply identical validation.
 */
export function normalizeNamespaces(parsed: unknown): Namespace[] {
  const stored = Array.isArray(parsed) ? parsed.filter(isNamespace) : [];

  const seen = new Set<string>();
  const deduped: Namespace[] = [];
  for (const ns of stored) {
    if (seen.has(ns.slug)) continue;
    seen.add(ns.slug);
    deduped.push(ns);
  }

  const defaultEntry =
    deduped.find((n) => n.slug === DEFAULT_NAMESPACE_SLUG) ?? DEFAULT_NAMESPACE;
  const others = deduped.filter((n) => n.slug !== DEFAULT_NAMESPACE_SLUG);
  return [defaultEntry, ...others];
}

/** Serialize a namespace list to the JSON you persist (a localStorage value,
 *  a `namespaces.json` blob). */
export function serializeNamespaces(list: Namespace[]): string {
  return JSON.stringify(list);
}

/**
 * Parse a raw persisted namespaces JSON string into a clean list. A missing
 * (`null`) or corrupt blob yields just the default namespace rather than
 * throwing, so a first run or a damaged store still renders.
 */
export function parseNamespaces(raw: string | null): Namespace[] {
  if (!raw) return normalizeNamespaces(null);
  try {
    return normalizeNamespaces(JSON.parse(raw));
  } catch {
    return normalizeNamespaces(null);
  }
}

/**
 * Merge a device's local namespace list with one a backend already holds, for
 * a "connect on a new device" reconcile. The remote side wins on any slug both
 * know (it's the shared source of truth, so its display name and appearance
 * are adopted), and namespaces that exist only locally are carried over — so
 * connecting publishes this device's own namespaces instead of dropping them.
 * The result is normalised (default first, deduped).
 */
export function mergeNamespaceLists(
  local: Namespace[],
  remote: Namespace[],
): Namespace[] {
  const bySlug = new Map<string, Namespace>();
  for (const ns of remote) if (!bySlug.has(ns.slug)) bySlug.set(ns.slug, ns);
  for (const ns of local) if (!bySlug.has(ns.slug)) bySlug.set(ns.slug, ns);
  return normalizeNamespaces([...bySlug.values()]);
}

/**
 * Whether `local` carries any namespace `remote` doesn't yet have — i.e.
 * whether a reconcile needs to push the merged list back up to publish this
 * device's own namespaces.
 */
export function hasLocalOnlyNamespaces(
  local: Namespace[],
  remote: Namespace[],
): boolean {
  const remoteSlugs = new Set(remote.map((n) => n.slug));
  return local.some((n) => !remoteSlugs.has(n.slug));
}

/**
 * Turn a free-text display name into a folder-/key-safe slug: lowercase,
 * non-alphanumerics collapsed to single hyphens, trimmed, length-capped. May
 * return an empty string for input with no usable characters — callers
 * substitute a fallback before allocating (`addNamespace` does this).
 */
export function slugify(
  name: string,
  maxLength: number = DEFAULT_MAX_SLUG_LENGTH,
): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

/**
 * Add a namespace to `list` from a display name, allocating a unique slug. The
 * default slug is reserved, and a collision disambiguates with a numeric
 * suffix. Returns the new list **and** the created namespace (so the caller
 * can switch to it). Throws on an empty name. Pure: `list` is not mutated.
 */
export function addNamespace(
  list: Namespace[],
  name: string,
): { list: Namespace[]; created: Namespace } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A namespace name is required");
  const base = slugify(trimmed) || "namespace";
  const taken = new Set(list.map((n) => n.slug));
  let slug = base;
  let counter = 2;
  while (taken.has(slug)) {
    slug = `${base}-${counter++}`;
  }
  const created: Namespace = { slug, name: trimmed };
  return { list: normalizeNamespaces([...list, created]), created };
}

/** Change a namespace's display name (the slug, and its data, stay put).
 *  A blank name is rejected (the original list is returned unchanged). */
export function renameNamespace(
  list: Namespace[],
  slug: string,
  name: string,
): Namespace[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return list.map((n) => (n.slug === slug ? { ...n, name: trimmed } : n));
}

/**
 * Set or clear a namespace's appearance (icon and/or accent colour). A field
 * present in `patch` is applied; pass `null` to clear it, omit it to leave it.
 * Works for the default namespace too. Pure: returns a new list.
 */
export function setNamespaceAppearance(
  list: Namespace[],
  slug: string,
  patch: NamespaceAppearance,
): Namespace[] {
  return list.map((n) => {
    if (n.slug !== slug) return n;
    const next: Namespace = { ...n };
    if ("glyph" in patch) {
      if (patch.glyph) next.glyph = patch.glyph;
      else delete next.glyph;
    }
    if ("color" in patch) {
      if (patch.color) next.color = patch.color;
      else delete next.color;
    }
    return next;
  });
}

/**
 * Remove a namespace from `list`. The default namespace can't be removed (it
 * is returned unchanged). Removing the namespace's *data* (its storage key /
 * folder) and re-pointing the active-namespace cursor are the caller's job —
 * this only edits the registry list.
 */
export function removeNamespace(list: Namespace[], slug: string): Namespace[] {
  if (slug === DEFAULT_NAMESPACE_SLUG) return list;
  return list.filter((n) => n.slug !== slug);
}
