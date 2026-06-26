<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/checklist`

The **nested checklist** — a reusable, checkable tree (shopping lists, packing
lists, task lists with sub-tasks) both source apps grew. One implementation of
the tree mechanics, the depth-indented row rendering, and the progress badge, so
an app gets the whole interaction — cascade-on-check, child checklists,
collapse, sink-checked ordering, progress — without re-deriving it.

## What it owns vs. what stays in your app

The framework owns the **tree** and its **look**: the pure operations over a
node tree (`tree.ts`) and the components that render it. Your app owns the
**domain and persistence** — where the data lives, what extra fields a node
carries (notes, tags, a template id, archived-ness), and the i18n. The node type
is deliberately minimal; an app intersects it to layer its own fields on.

| Export                                                                    | Kind      | What it is                                                         |
| ------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `Checklist`                                                               | component | The nested list: depth-indented checkable rows + collapse + grips. |
| `ChecklistProgress`                                                       | component | The header ring badge (`checked / total`) with optional bulk menu. |
| `ChecklistNode`                                                           | type      | `{ id; label; checked; checkedAt?; children? }`.                   |
| `toggleNode` / `setNodeChecked` / `setAllChecked`                         | fn        | Check operations — **cascade** the new state down the subtree.     |
| `countProgress` / `isComplete` / `subtreeState`                           | fn        | Tallies and the indeterminate cue.                                 |
| `sortCheckedToBottom` / `flattenForDisplay` / `flattenNodes` / `findNode` | fn        | View ordering and tree walks.                                      |

## The model

```ts
type ChecklistNode = {
  id: string;
  label: ReactNode; // a string, or any node the row renders
  checked: boolean;
  checkedAt?: string; // ISO stamp; set on check, drives sink-checked recency
  children?: ChecklistNode[]; // a "child checklist"
};
```

Two semantics carry the behaviour both apps relied on:

- **Cascade.** Toggling a node sets its **whole subtree** to the new value — a
  checked-off group reads as done top to bottom. `toggleNode` /
  `setNodeChecked` / `setAllChecked` all cascade.
- **Sink checked.** With `sinkChecked`, checked items sort to the bottom of each
  sub-list, most-recently-checked first (by `checkedAt`). The ordering is
  **view-only** — `onChange` never persists it, so the stored document keeps its
  authored order.

## Usage

The `Checklist` is controlled — hold the tree in state, pass `onChange`:

```tsx
import {
  Checklist,
  ChecklistProgress,
  countProgress,
  setAllChecked,
  type ChecklistNode,
} from "@niclaslindstedt/oss-framework/checklist";

function Shopping() {
  const [items, setItems] = useState<ChecklistNode[]>([
    { id: "milk", label: "Milk", checked: false },
    {
      id: "veg",
      label: "Vegetables",
      checked: false,
      children: [
        { id: "tom", label: "Tomatoes", checked: false },
        { id: "let", label: "Lettuce", checked: false },
      ],
    },
  ]);
  const { checked, total } = countProgress(items);

  return (
    <>
      <ChecklistProgress
        checked={checked}
        total={total}
        onCheckAll={() => setItems((p) => setAllChecked(p, true))}
        onUncheckAll={() => setItems((p) => setAllChecked(p, false))}
      />
      <Checklist items={items} onChange={setItems} sinkChecked showGrips />
    </>
  );
}
```

Driving your **own store** instead of local state? Skip the components and use
`tree.ts` directly — every function is a pure `(tree) => tree` transform, so it
slots into a reducer or a `useSyncExternalStore` update with no DOM.

`react` / `react-dom` are peer dependencies; the components build on
`@niclaslindstedt/oss-framework/components` (the `Checkbox`, the glyphs, the
`FloatingPanel` the bulk menu opens in), so they paint through the same theme
token vocabulary — see [`../components/README.md`](../components/README.md) for
the slot contract.

## Migrating an existing implementation

In degree-of-match order:

- **You already render a flat checklist.** Map your items to `ChecklistNode`
  (`title` → `label`), drop your toggle/count helpers in favour of `toggleNode`
  / `countProgress`, and render `<Checklist>`. Sub-items come for free the day
  you populate `children`.
- **You store richer items** (notes, archived, a template id). Keep them:
  intersect the type — `type Item = ChecklistNode & { notes?: string }` — and
  the tree functions ignore the extra fields (they're pure spreads). Render the
  richer label via the `label` node; archived-ness is a filter you apply before
  handing `items` in.
- **Your toggle didn't cascade, or cascaded differently.** This one always
  cascades the full subtree. If you stored a parent's checked state independently
  of its children, `subtreeState(node)` gives you the `checked` / `unchecked` /
  `mixed` cue to render an indeterminate parent.
- **You persisted the sink-checked order.** Don't — pass `sinkChecked` and keep
  the document in authored order; the ordering is re-derived for display.
- **You had drag-to-reorder.** `Checklist` renders the grip (`showGrips`) and
  fires `onReorderStart(id, event)` on grip press; wire it to your own drag
  (the framework ships the affordance, not a DnD engine).

## Verification

- Checking a parent checks every descendant; unchecking clears them.
- The progress ring tracks `checked / total` and turns `success`-toned at 100%.
- A parent row's caret collapses/expands its children.
- With `sinkChecked`, checked rows drop to the bottom but the stored order
  (what `onChange` emits) is unchanged.
