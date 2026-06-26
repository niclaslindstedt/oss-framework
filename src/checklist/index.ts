// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The nested checklist — a reusable, checkable tree both source apps grew
// (shopping lists, packing lists, task lists with sub-tasks). The `Checklist`
// component renders the depth-indented rows; `ChecklistProgress` is the header
// ring badge; `tree.ts` is the pure, DOM-free core (toggle-with-cascade,
// progress counts, sort-checked-to-bottom, flatten-for-display) an app can
// drive its own store with. App domain (notes, tags, persistence) layers on
// top of `ChecklistNode`; the framework owns the tree mechanics and the look.

export { Checklist } from "./Checklist.tsx";
export { ChecklistProgress } from "./ChecklistProgress.tsx";
export {
  flattenNodes,
  findNode,
  toggleNode,
  setNodeChecked,
  setAllChecked,
  removeNode,
  countProgress,
  isComplete,
  subtreeState,
  sortCheckedToBottom,
  flattenForDisplay,
  type ChecklistNode,
  type DisplayRow,
} from "./tree.ts";
