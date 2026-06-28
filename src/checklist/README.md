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
| `removeNode`                                                              | fn        | Drop a node (and its subtree) from anywhere in the tree.           |
| `renameNode`                                                              | fn        | Replace a node's label, leaving the rest of the tree shared.       |
| `moveNode`                                                                | fn        | Move a node (and its subtree) before/after another, reparenting.   |
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

### Swipe-to-delete

Pass `onDelete` and the rows become swipeable — the
[`useRowSwipe`](../hooks/README.md) gesture both source apps grew. A left swipe
latches a **Delete** button open (a deliberate two-step); a right swipe flicks
the row off. Either fires `onDelete(id)`; the framework never mutates the tree,
so you perform the removal and stack it on your own undo history:

```tsx
<Checklist
  items={items}
  onChange={setItems}
  onDelete={(id) => setItems((p) => removeNode(p, id))}
  deleteLabel="Delete" // English default; pass a translated string
/>
```

`deleteLabel` is the only visible string; everything else paints through the
theme tokens (`bg-danger` behind the foreground, `bg-page-bg` on the row). Leave
`onDelete` unset and rows render plain — no gesture, no extra DOM.

### Edit in place

Pass `editable` and a row's **string** label becomes a tap-to-edit field — an
[`InlineEditField`](../components/README.md) that mounts focused with its text
selected, commits on Enter/blur and cancels on Escape. The commit flows through
the same `onChange`, with the relabelled tree (`renameNode` under the hood):

```tsx
<Checklist
  items={items}
  onChange={setItems}
  editable
  editPlaceholder="Edit item" // English default; pass a translated string
/>
```

A non-string label (a rich `ReactNode`) stays read-only.

### Drag to reorder

Pass `reorderable` and rows lift to drag: a **long press** (touch) or a press on
the **grip** (`showGrips`) picks a row up, and dropping it before/after another
row reorders the tree (`moveNode`) through `onChange`. The drop reparents the
dragged node — subtree and all — into the target's sibling list, so a row can
move between child checklists, not just within its own level:

```tsx
<Checklist items={items} onChange={setItems} reorderable showGrips />
```

The gesture rides Pointer Events (touch + mouse + pen) and a held drag suppresses
the row's own tap, so dragging never toggles or opens the editor. Driving your
own store? `moveNode(tree, dragId, targetId, "before" | "after")` and
`renameNode(tree, id, label)` are the pure transforms behind both.

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
  intersect the type — `type Item = ChecklistNode & { archived?: boolean }` —
  and the tree functions, generic over your node type, carry the extra fields
  through with their types intact (`removeNode(items, id)` returns `Item[]`, not
  a bare `ChecklistNode[]`). Render the richer label via the `label` node;
  hiding a subset (an archived flag, say) is the `isHidden` predicate you hand
  `Checklist` / `flattenForDisplay` / `countProgress` — the framework owns no
  such flag.
- **Your toggle didn't cascade, or cascaded differently.** This one always
  cascades the full subtree. If you stored a parent's checked state independently
  of its children, `subtreeState(node)` gives you the `checked` / `unchecked` /
  `mixed` cue to render an indeterminate parent.
- **You persisted the sink-checked order.** Don't — pass `sinkChecked` and keep
  the document in authored order; the ordering is re-derived for display.
- **You had drag-to-reorder.** `Checklist` renders the grip (`showGrips`) and
  fires `onReorderStart(id, event)` on grip press; wire it to your own drag
  (the framework ships the affordance, not a DnD engine).
- **You had swipe-to-delete (or a second flick-off action).** Wire `onDelete`
  (delete via `removeNode`) for the left-swipe Delete reveal, and `swipeAction`
  for a right-swipe commit you name yourself — the demo flicks a row to its
  archive that way, passing `swipeAction.label` / `.icon`; the framework names
  neither the action nor its caption. For anything richer than these two sides,
  drop to the bare `useRowSwipe` hook app-side.

## Verification

- Checking a parent checks every descendant; unchecking clears them.
- The progress ring tracks `checked / total` and turns `success`-toned at 100%.
- A parent row's caret collapses/expands its children.
- With `sinkChecked`, checked rows drop to the bottom but the stored order
  (what `onChange` emits) is unchanged.
- With `onDelete`, swiping a row left reveals Delete and tapping it (or flicking
  the row right) emits the row's id; the row leaves only after you `removeNode`.
