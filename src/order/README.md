<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `order` — stored arrangements

A user-rearranged list is persisted as a **list of ids**, not as the entries
themselves: the entries belong to the build (components, callbacks, translated
labels), the arrangement belongs to the user. This module is the arithmetic
over that shape.

```ts
import {
  applyOrder,
  moveInOrder,
  orderOf,
} from "@niclaslindstedt/oss-framework/order";

const TOOLS = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "fill", label: "Fill" },
];

// What the user stored, some releases ago — before `fill` existed.
const stored = ["eraser", "pencil"];

applyOrder(TOOLS, stored);
// [eraser, pencil, fill] — the two named ids swap, `fill` keeps its slot.

orderOf(moveInOrder(orderOf(TOOLS), 2, 0)); // ["fill", "pencil", "eraser"]
```

## Why it isn't a sort

A stored order is read by builds that ship a different entry set than the one
that wrote it. Two things follow, and both are the reason this is a module
rather than three copies of a `sort` comparator:

- **An unknown id is dropped**, not honoured — otherwise it leaves a hole.
- **An unmentioned entry keeps its registered position**, rather than being
  appended. Appending would exile every entry added since the order was stored
  to the end of a list its author had a place for.

Everything here is pure, so a whole reorder can be driven from a node test.
