<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `namespaces` — named buckets that each hold their own document

A **namespace** is a named bucket — a profile, a workspace, a category, a
"space" — that holds its own document. Switching the active namespace swaps
which document your app reads and writes, so a personal set and a shared one
can sit side by side without one bleeding into the other. This module supplies
the parts that are the same for every app: the `Namespace` data shape, the pure
list operations over it, a favicon resolver that re-badges the tab to the
active namespace, and the management dialog.

```ts
import {
  type Namespace,
  type NamespaceAppearance,
  DEFAULT_NAMESPACE,
  parseNamespaces,
  serializeNamespaces,
  addNamespace,
  renameNamespace,
  setNamespaceAppearance,
  removeNamespace,
  namespaceFaviconHref,
  applyFaviconHref,
  NamespacesModal,
} from "@niclaslindstedt/oss-framework/namespaces";
```

## What it owns vs. what stays in your app

This module is **storage-free by design**. It owns the namespace _data shape_,
the _pure transforms_ over a `Namespace[]`, the favicon resolver, and the
management UI. It deliberately does **not** own where the list and the
active-namespace pointer live, or how a slug maps to a concrete storage
location — those are coupled to the backend you chose and the keys your data
already sits under, so they stay in your app. This is the same store seam every
other module draws.

| In the framework                                               | In your app                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Namespace` / `NamespaceAppearance` types, `DEFAULT_NAMESPACE` | the `Namespace[]` registry + active-slug pointer (where they live) |
| pure list ops (`addNamespace`, `renameNamespace`, …)           | the store/hook that holds the list and persists it                 |
| `parseNamespaces` / `serializeNamespaces`                      | reading/writing the persisted blob (localStorage, a synced file)   |
| `namespaceFaviconHref` / `applyFaviconHref`                    | when to re-badge (e.g. on an active-namespace swap)                |
| `NamespacesModal` (presentational)                             | mapping a slug → document, and removing a namespace's data         |

The favicon resolver leans on the [`glyphs`](../glyphs/README.md) module, and
the dialog composes the framework's own `Modal` / `ConfirmDialog` / `Button` /
`GlyphPicker` / `ColorPalette` — so a namespace's icon and colour come from the
same catalogue everything else in your app draws from.

## The contract

- **The `slug` is the stable handle; the `name` is a label.** Allocate the slug
  once (`addNamespace` does, deduping collisions with a numeric suffix) and
  derive every storage location from it. A rename touches only `name`, so it
  never moves data.
- **The pure ops never persist.** Each takes a `Namespace[]` and returns a new
  one (or a derived value). Feed the result back into your store; nothing here
  reads or writes storage, the DOM, or React.
- **The default namespace is always present.** `normalizeNamespaces` (and the
  `parse*` helper that funnels through it) materialise `DEFAULT_NAMESPACE` at
  the front, dedupe slugs, and drop corrupt entries — so a first run or a
  damaged blob still yields a usable list. `removeNamespace` refuses to drop
  the default.
- **`addNamespace` returns `{ list, created }`.** The created namespace comes
  back so you can switch to it immediately; the other ops return just the list.
- **The dialog carries no i18n.** Every string injects through `labels` with
  English defaults; pass your translator's output to localise it.

## Quick start

Hold the list and the active slug in your app's store, persisting with the
`parse`/`serialize` helpers, and drive every mutation through the pure ops:

```ts
const LIST_KEY = "myapp:namespaces";
const ACTIVE_KEY = "myapp:namespace:active";

function load(): Namespace[] {
  return parseNamespaces(localStorage.getItem(LIST_KEY));
}
function save(list: Namespace[]): void {
  localStorage.setItem(LIST_KEY, serializeNamespaces(list));
}

function useNamespaces() {
  const [list, setList] = useState(load);
  const [activeSlug, setActiveSlug] = useState(
    () => localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_NAMESPACE.slug,
  );
  const commit = (next: Namespace[]) => {
    save(next);
    setList(next);
  };
  return {
    list,
    activeSlug,
    switchTo: (slug: string) => {
      localStorage.setItem(ACTIVE_KEY, slug);
      setActiveSlug(slug);
    },
    create: (name: string, appearance?: NamespaceAppearance) => {
      const { list: next, created } = addNamespace(list, name);
      commit(
        appearance
          ? setNamespaceAppearance(next, created.slug, appearance)
          : next,
      );
      return created;
    },
    rename: (slug: string, name: string) =>
      commit(renameNamespace(list, slug, name)),
    setAppearance: (slug: string, patch: NamespaceAppearance) =>
      commit(setNamespaceAppearance(list, slug, patch)),
    remove: (slug: string) => {
      commit(removeNamespace(list, slug));
      // …and delete the namespace's *data* + re-point the active pointer.
    },
  };
}
```

Wire the management dialog to that store — it is presentational, so you pass
the list and the operations in:

```tsx
<NamespacesModal
  open={open}
  onClose={() => setOpen(false)}
  namespaces={ns.list}
  activeNamespace={ns.activeSlug}
  onSwitch={ns.switchTo}
  onCreate={ns.create}
  onRename={ns.rename}
  onSetAppearance={ns.setAppearance}
  onRemove={ns.remove}
/>
```

Re-badge the tab to the active namespace whenever it changes:

```ts
useEffect(() => {
  const active = ns.list.find((n) => n.slug === ns.activeSlug);
  applyFaviconHref(
    namespaceFaviconHref(active, `${import.meta.env.BASE_URL}favicon.svg`, {
      defaultColor: "#86efac",
    }),
  );
}, [ns.activeSlug, ns.list]);
```

## API

### Data

| Symbol                                         | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Namespace`, `NamespaceAppearance`             | the bucket shape (`slug`, `name`, optional `glyph`/`color`) and a partial restyle  |
| `DEFAULT_NAMESPACE`, `DEFAULT_NAMESPACE_SLUG`  | the always-present default (`"default"`)                                           |
| `isNamespace(value)`                           | type guard for a parsed entry                                                      |
| `normalizeNamespaces(parsed)`                  | coerce any value → clean list (default-first, deduped, validated)                  |
| `parseNamespaces(raw)` / `serializeNamespaces` | round-trip the persisted JSON blob                                                 |
| `mergeNamespaceLists(local, remote)`           | reconcile two lists on connect (remote wins shared slugs, local-only carried over) |
| `hasLocalOnlyNamespaces(local, remote)`        | whether a reconcile needs to push the merged list back up                          |
| `slugify(name, maxLength?)`                    | free text → folder-/key-safe slug                                                  |
| `addNamespace(list, name)`                     | → `{ list, created }`, allocating a unique slug (throws on empty name)             |
| `renameNamespace(list, slug, name)`            | → list with the display name changed (blank name is a no-op)                       |
| `setNamespaceAppearance(list, slug, patch)`    | → list with glyph/colour set or cleared                                            |
| `removeNamespace(list, slug)`                  | → list without the namespace (the default is never removed)                        |

### Favicon

- `namespaceFaviconHref(ns, fallbackHref, options?)` — the namespace's glyph as
  a data URI when it has a valid one, otherwise `fallbackHref`. `options.defaultColor`
  tints a glyph chosen without a colour; `options.badge` forwards
  [`GlyphBadgeOptions`](../glyphs/README.md) (size, radius, background, padding).
- `applyFaviconHref(href)` — point the document's `<link rel="icon">` at `href`
  (SSR-safe no-op off the browser).

### UI

- `NamespacesModal` — the full create / switch / rename / restyle / delete
  surface. Presentational; `labels` (English defaults) localise it, and
  `glyphs` / `colors` override the picker catalogues (defaulting to the
  framework's `GLYPH_NAMES` / `GLYPH_COLORS`).

## Adapting to your app

A new app's needs rarely match a component exactly. The likely mismatches:

- **You don't want appearance (icon/colour).** The fields are optional — never
  set `glyph`/`color` and the rows render a plain default mark; you can pass a
  trimmed `NamespacesModal` by leaving the pickers as-is (they're harmless) or
  build your own switcher over the data helpers and skip the dialog entirely.
- **You sync the registry across devices.** Persist `serializeNamespaces(list)`
  to your synced store (a `namespaces.json` beside your settings), and on
  connect reconcile with `mergeNamespaceLists` / `hasLocalOnlyNamespaces`
  before adopting it — both are pure, so they slot into whatever transport you
  use. Keep the **active-namespace pointer device-local** (which bucket you're
  looking at is a cursor, not shared state).
- **A slug must map to a storage location.** That mapping is yours: e.g. the
  default keeps your historical key (`myapp/v1`) for a no-migration upgrade and
  others get a per-slug suffix (`myapp/v1:<slug>`), or each namespace gets its
  own cloud folder (`<slug>/`). Write a `namespaceKey(slug)` / `namespaceFolder(slug)`
  in your storage layer — the framework deliberately doesn't, because the right
  answer depends on your backend and existing data.
- **Deleting a namespace must delete its data.** `removeNamespace` only edits
  the registry list. In your `onRemove`, also clear the namespace's document
  (its key / folder) and, if it was active, re-point the active pointer to the
  default. `NamespacesModal` awaits `onRemove`, so a slow cloud delete shows the
  confirm spinner.
- **More fields per namespace.** Intersect the type app-side
  (`type Profile = Namespace & { avatarUrl?: string }`) — the pure ops spread
  `...n`, so extra fields survive a rename/restyle. Keep domain data out of the
  framework type.

## Verification

- `make test` covers the pure list ops and the favicon resolver
  (`tests/namespaces.test.ts`).
- In the running app: switch namespaces and confirm the document swaps and the
  tab favicon re-badges; create / rename / restyle / delete and confirm each
  persists across a reload; delete the active namespace and confirm it falls
  back to the default.
