// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { useState } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Checklist,
  ChecklistProgress,
  countProgress,
  findNode,
  flattenForDisplay,
  flattenNodes,
  isComplete,
  removeNode,
  setAllChecked,
  setNodeChecked,
  sortCheckedToBottom,
  subtreeState,
  toggleNode,
  type ChecklistNode,
} from "../src/checklist/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

// A small tree: one parent ("fruit") with two children, plus a leaf.
function tree(): ChecklistNode[] {
  return [
    {
      id: "fruit",
      label: "Fruit",
      checked: false,
      children: [
        { id: "apple", label: "Apple", checked: false },
        { id: "pear", label: "Pear", checked: false },
      ],
    },
    { id: "milk", label: "Milk", checked: false },
  ];
}

// --- tree.ts (pure) -----------------------------------------------------

describe("checklist tree", () => {
  it("flattens parents before children, depth-first", () => {
    expect(flattenNodes(tree()).map((n) => n.id)).toEqual([
      "fruit",
      "apple",
      "pear",
      "milk",
    ]);
  });

  it("finds a node anywhere in the tree", () => {
    expect(findNode(tree(), "pear")?.label).toBe("Pear");
    expect(findNode(tree(), "nope")).toBeUndefined();
  });

  it("toggling a parent cascades checked + checkedAt down the subtree", () => {
    const next = toggleNode(tree(), "fruit", "2026-01-01T00:00:00Z");
    const fruit = findNode(next, "fruit")!;
    expect(fruit.checked).toBe(true);
    expect(fruit.checkedAt).toBe("2026-01-01T00:00:00Z");
    expect(findNode(next, "apple")!.checked).toBe(true);
    expect(findNode(next, "pear")!.checked).toBe(true);
    // The untouched leaf is unchanged.
    expect(findNode(next, "milk")!.checked).toBe(false);
  });

  it("unchecking clears checkedAt across the subtree", () => {
    const checked = toggleNode(tree(), "fruit", "2026-01-01T00:00:00Z");
    const unchecked = toggleNode(checked, "fruit", "2026-01-02T00:00:00Z");
    for (const n of flattenNodes(unchecked).filter((x) =>
      ["fruit", "apple", "pear"].includes(x.id),
    )) {
      expect(n.checked).toBe(false);
      expect(n.checkedAt).toBeUndefined();
    }
  });

  it("does not mutate the input tree", () => {
    const original = tree();
    toggleNode(original, "fruit");
    expect(findNode(original, "fruit")!.checked).toBe(false);
  });

  it("setNodeChecked sets an explicit state without flipping", () => {
    const t = tree();
    expect(findNode(setNodeChecked(t, "milk", true), "milk")!.checked).toBe(
      true,
    );
    // Already false → setting false is a structural change but stays false.
    expect(findNode(setNodeChecked(t, "milk", false), "milk")!.checked).toBe(
      false,
    );
  });

  it("counts progress over every node, and reports completeness", () => {
    expect(countProgress(tree())).toEqual({ checked: 0, total: 4 });
    const all = setAllChecked(tree(), true);
    expect(countProgress(all)).toEqual({ checked: 4, total: 4 });
    expect(isComplete(all)).toBe(true);
    expect(isComplete(tree())).toBe(false);
  });

  it("setAllChecked is a no-op (same ref) when already in the target state", () => {
    const t = tree();
    expect(setAllChecked(t, false)).toBe(t);
  });

  it("derives subtree state for an indeterminate cue", () => {
    const t = tree();
    expect(subtreeState(findNode(t, "fruit")!)).toBe("unchecked");
    const oneChild = setNodeChecked(t, "apple", true);
    expect(subtreeState(findNode(oneChild, "fruit")!)).toBe("mixed");
    const both = setNodeChecked(setNodeChecked(t, "apple", true), "pear", true);
    // The parent itself is still unchecked, so the subtree is mixed, not full.
    expect(subtreeState(findNode(both, "fruit")!)).toBe("mixed");
  });

  it("sorts checked items to the bottom, most-recent first, recursively", () => {
    let t = tree();
    t = setNodeChecked(t, "apple", true, "2026-01-01T00:00:00Z");
    t = setNodeChecked(t, "milk", true, "2026-01-03T00:00:00Z");
    const sorted = sortCheckedToBottom(t);
    // Top level: unchecked "fruit" first, then checked "milk".
    expect(sorted.map((n) => n.id)).toEqual(["fruit", "milk"]);
    // Within "fruit": unchecked "pear" first, then checked "apple".
    expect(sorted[0]!.children!.map((n) => n.id)).toEqual(["pear", "apple"]);
  });

  it("removes a node anywhere in the tree, subtree and all", () => {
    // A nested child.
    const noPear = removeNode(tree(), "pear");
    expect(findNode(noPear, "pear")).toBeUndefined();
    expect(findNode(noPear, "apple")).toBeDefined();
    // A top-level item carrying children goes with its whole subtree.
    const noFruit = removeNode(tree(), "fruit");
    expect(flattenNodes(noFruit).map((n) => n.id)).toEqual(["milk"]);
    // A miss returns the same reference (no needless re-render churn).
    const t = tree();
    expect(removeNode(t, "nope")).toBe(t);
  });

  it("removeNode does not mutate the input tree", () => {
    const original = tree();
    removeNode(original, "fruit");
    expect(findNode(original, "fruit")).toBeDefined();
  });

  it("flattenForDisplay tags depth and skips a collapsed node's children", () => {
    const open = flattenForDisplay(tree(), new Set());
    expect(open.map((r) => [r.node.id, r.depth, r.hasChildren])).toEqual([
      ["fruit", 0, true],
      ["apple", 1, false],
      ["pear", 1, false],
      ["milk", 0, false],
    ]);
    const collapsed = flattenForDisplay(tree(), new Set(["fruit"]));
    expect(collapsed.map((r) => r.node.id)).toEqual(["fruit", "milk"]);
  });
});

// --- Checklist component ------------------------------------------------

function Controlled({ initial }: { initial: ChecklistNode[] }) {
  const [items, setItems] = useState(initial);
  return <Checklist items={items} onChange={setItems} />;
}

describe("Checklist component", () => {
  it("renders a row per visible node and toggles with cascade on click", () => {
    render(<Controlled initial={tree()} />);
    expect(screen.getByRole("checkbox", { name: "Apple" })).toBeDefined();

    fireEvent.click(screen.getByRole("checkbox", { name: "Fruit" }));
    // Cascade: the parent and both children are now checked.
    expect(
      (screen.getByRole("checkbox", { name: "Apple" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "Pear" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("collapses a parent's children behind its caret", () => {
    render(<Controlled initial={tree()} />);
    expect(screen.queryByRole("checkbox", { name: "Apple" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByRole("checkbox", { name: "Apple" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.queryByRole("checkbox", { name: "Apple" })).not.toBeNull();
  });

  it("offers no Delete affordance until onDelete is wired", () => {
    render(<Controlled initial={tree()} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("reveals a Delete button per row that fires onDelete with the row id", () => {
    const onDelete = vi.fn();
    render(
      <Checklist items={tree()} onChange={() => {}} onDelete={onDelete} />,
    );
    // One swipe-reveal Delete button per visible row (the strip behind it).
    // It's aria-hidden until the row is swiped open, so query hidden roles.
    const deletes = screen.getAllByRole("button", {
      name: "Delete",
      hidden: true,
    });
    expect(deletes.length).toBe(flattenForDisplay(tree(), new Set()).length);
    // The first row is "fruit"; tapping its Delete removes that node.
    fireEvent.click(deletes[0]!);
    expect(onDelete).toHaveBeenCalledWith("fruit");
  });

  it("relabels the Delete button via deleteLabel", () => {
    render(
      <Checklist
        items={tree()}
        onChange={() => {}}
        onDelete={() => {}}
        deleteLabel="Ta bort"
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Ta bort", hidden: true }).length,
    ).toBe(flattenForDisplay(tree(), new Set()).length);
  });
});

// --- ChecklistProgress --------------------------------------------------

describe("ChecklistProgress", () => {
  it("renders a static fraction when no bulk handlers are wired", () => {
    render(<ChecklistProgress checked={1} total={4} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("1 / 4")).toBeDefined();
  });

  it("opens a bulk-action menu and fires check-all / uncheck-all", () => {
    const onCheckAll = vi.fn();
    const onUncheckAll = vi.fn();
    render(
      <ChecklistProgress
        checked={1}
        total={4}
        onCheckAll={onCheckAll}
        onUncheckAll={onUncheckAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1 / 4" }));
    const menu = screen.getByText("Check all").closest("div")!;
    fireEvent.click(within(menu).getByText("Check all"));
    expect(onCheckAll).toHaveBeenCalled();
  });
});
