// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { useRef, useState } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Checklist,
  ChecklistProgress,
  countProgress,
  findNode,
  flattenForDisplay,
  flattenNodes,
  insertNode,
  isComplete,
  moveNode,
  removeNode,
  renameNode,
  setAllChecked,
  setNodeChecked,
  sortCheckedToBottom,
  subtreeState,
  toggleNode,
  updateNode,
  type ChecklistNode,
} from "../src/checklist/index.ts";

// An app's richer node — the framework owns no "archived" flag, so a consumer
// layers its own and drives the generic helpers with it. Exercised below to
// prove the node type round-trips through the tree transforms.
type Item = ChecklistNode & { archived?: boolean };

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

  it("renameNode replaces a node's label, leaving the rest", () => {
    const next = renameNode(tree(), "milk", "Oat milk");
    expect(findNode(next, "milk")!.label).toBe("Oat milk");
    expect(findNode(next, "apple")!.label).toBe("Apple");
    // A miss returns the same reference.
    const t = tree();
    expect(renameNode(t, "nope", "x")).toBe(t);
  });

  it("renameNode does not mutate the input tree", () => {
    const original = tree();
    renameNode(original, "milk", "Oat milk");
    expect(findNode(original, "milk")!.label).toBe("Milk");
  });

  it("moveNode reorders siblings before / after a target", () => {
    // "milk" before "fruit" at the top level.
    expect(
      moveNode(tree(), "milk", "fruit", "before").map((n) => n.id),
    ).toEqual(["milk", "fruit"]);
    // "apple" after "pear" within the "fruit" subtree.
    const within = moveNode(tree(), "apple", "pear", "after");
    expect(findNode(within, "fruit")!.children!.map((n) => n.id)).toEqual([
      "pear",
      "apple",
    ]);
  });

  it("moveNode reparents into the target's sibling list", () => {
    // Top-level "milk" dropped before "apple" (inside "fruit").
    const next = moveNode(tree(), "milk", "apple", "before");
    expect(next.map((n) => n.id)).toEqual(["fruit"]);
    expect(findNode(next, "fruit")!.children!.map((n) => n.id)).toEqual([
      "milk",
      "apple",
      "pear",
    ]);
  });

  it("moveNode carries the dragged node's whole subtree", () => {
    const next = moveNode(tree(), "fruit", "milk", "after");
    expect(next.map((n) => n.id)).toEqual(["milk", "fruit"]);
    expect(findNode(next, "fruit")!.children!.map((n) => n.id)).toEqual([
      "apple",
      "pear",
    ]);
  });

  it("moveNode is a no-op for self, a miss, or a drop into its own subtree", () => {
    const t = tree();
    expect(moveNode(t, "fruit", "fruit", "before")).toBe(t);
    expect(moveNode(t, "fruit", "nope", "before")).toBe(t);
    expect(moveNode(t, "nope", "milk", "before")).toBe(t);
    // "apple" lives inside "fruit" — dropping "fruit" by it would orphan it.
    expect(moveNode(t, "fruit", "apple", "after")).toBe(t);
  });

  it("moveNode does not mutate the input tree", () => {
    const original = tree();
    moveNode(original, "milk", "fruit", "before");
    expect(original.map((n) => n.id)).toEqual(["fruit", "milk"]);
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

  it("updateNode sets and clears an app-defined field, leaving the rest", () => {
    const arch = updateNode<Item>(tree(), "milk", (n) => ({
      ...n,
      archived: true,
    }));
    // The flag — and its type — survive the transform.
    expect(findNode(arch, "milk")!.archived).toBe(true);
    expect(findNode(arch, "apple")!.archived).toBeUndefined();
    // The app clears its own flag however it likes — here deleting it so the
    // node round-trips byte-for-byte.
    const live = updateNode<Item>(arch, "milk", (n) => {
      const next = { ...n };
      delete next.archived;
      return next;
    });
    expect("archived" in findNode(live, "milk")!).toBe(false);
  });

  it("insertNode drops a node at top / bottom / after a sibling", () => {
    const node: ChecklistNode = { id: "x", label: "X", checked: false };
    expect(insertNode(tree(), node, { at: "top" }).map((n) => n.id)).toEqual([
      "x",
      "fruit",
      "milk",
    ]);
    expect(insertNode(tree(), node, { at: "bottom" }).map((n) => n.id)).toEqual(
      ["fruit", "milk", "x"],
    );
    // After a nested node lands as its sibling, at that node's own depth.
    const within = insertNode(tree(), node, { after: "apple" });
    expect(findNode(within, "fruit")!.children!.map((n) => n.id)).toEqual([
      "apple",
      "x",
      "pear",
    ]);
    // A missing `after` target falls back to appending at the root.
    expect(
      insertNode(tree(), node, { after: "nope" }).map((n) => n.id),
    ).toEqual(["fruit", "milk", "x"]);
  });

  it("flattenForDisplay and countProgress honour the isHidden predicate", () => {
    const arch = updateNode<Item>(tree(), "milk", (n) => ({
      ...n,
      archived: true,
    }));
    const hidden = (n: Item) => n.archived === true;
    expect(
      flattenForDisplay(arch, new Set(), hidden).map((r) => r.node.id),
    ).toEqual(["fruit", "apple", "pear"]);
    expect(countProgress(arch, hidden)).toEqual({ checked: 0, total: 3 });
    // With no predicate, nothing is hidden — every node counts.
    expect(countProgress(arch)).toEqual({ checked: 0, total: 4 });
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

  it("forwards a row right-click to onRowContextMenu with the row id", () => {
    const onRowContextMenu = vi.fn();
    render(
      <Checklist
        items={tree()}
        onChange={() => {}}
        onRowContextMenu={onRowContextMenu}
      />,
    );
    // Right-click the "Milk" row (right-click targets its enclosing <li>).
    fireEvent.contextMenu(
      screen.getByRole("checkbox", { name: "Milk" }).closest("li")!,
    );
    expect(onRowContextMenu).toHaveBeenCalledTimes(1);
    expect(onRowContextMenu.mock.calls[0]![0]).toBe("milk");
  });

  it("keeps rows read-only until editable is set", () => {
    render(<Controlled initial={tree()} />);
    // The label is plain text, not an editable button.
    expect(screen.queryByRole("button", { name: "Milk" })).toBeNull();
  });

  it("edits a row's label in place on click", () => {
    function Editable() {
      const [items, setItems] = useState(tree());
      return <Checklist items={items} onChange={setItems} editable />;
    }
    render(<Editable />);
    // The label renders as a tap-to-edit button.
    fireEvent.click(screen.getByRole("button", { name: "Milk" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Oat milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Oat milk" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Milk" })).toBeNull();
  });

  it("cancels an edit on Escape, keeping the old label", () => {
    function Editable() {
      const [items, setItems] = useState(tree());
      return <Checklist items={items} onChange={setItems} editable />;
    }
    render(<Editable />);
    fireEvent.click(screen.getByRole("button", { name: "Milk" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Milk" })).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("lifts a row on a grip press and drops without committing on cancel", () => {
    const onChange = vi.fn();
    render(
      <Checklist items={tree()} onChange={onChange} reorderable showGrips />,
    );
    const grips = screen.getAllByRole("button", { name: "Reorder" });
    fireEvent.pointerDown(grips[0]!);
    // The lifted row is flagged for the drag.
    expect(document.querySelector('[data-dragging="true"]')).not.toBeNull();
    // A cancelled drag drops nothing and commits nothing.
    fireEvent.pointerCancel(window);
    expect(document.querySelector('[data-dragging="true"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("bares a caller-named commit backdrop on right-swipe, keeping Delete on the left", () => {
    const rowCount = flattenForDisplay(tree(), new Set()).length;
    render(
      <Checklist
        items={tree()}
        onChange={() => {}}
        onDelete={() => {}}
        // The app names the right-swipe commit; the framework defaults nothing.
        swipeAction={{ onCommit: () => {}, label: "Shelve" }}
      />,
    );
    // The commit backdrop (caption) per row, plus the left-swipe Delete strip.
    expect(screen.getAllByText("Shelve").length).toBe(rowCount);
    expect(
      screen.getAllByRole("button", { name: "Delete", hidden: true }).length,
    ).toBe(rowCount);
  });

  it("places the caret at the end when editing a row (no select-all)", () => {
    function Editable() {
      const [items, setItems] = useState(tree());
      return <Checklist items={items} onChange={setItems} editable />;
    }
    render(<Editable />);
    fireEvent.click(screen.getByRole("button", { name: "Milk" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.selectionStart).toBe("Milk".length);
    expect(input.selectionEnd).toBe("Milk".length);
  });

  it("adds via the composer and stays open on Enter", () => {
    function Composer() {
      const [items, setItems] = useState<ChecklistNode[]>([
        { id: "a", label: "A", checked: false },
      ]);
      const [composing, setComposing] = useState(true);
      const seq = useRef(0);
      return (
        <Checklist
          items={items}
          onChange={setItems}
          editable
          composing={composing}
          onComposingChange={setComposing}
          onAdd={(label, position) => {
            const id = `new-${(seq.current += 1)}`;
            setItems((cur) =>
              insertNode(cur, { id, label, checked: false }, position),
            );
            return id;
          }}
        />
      );
    }
    render(<Composer />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // The item landed and the composer stayed open for the next entry.
    expect(screen.getByRole("button", { name: "Buy milk" })).toBeDefined();
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("opens a draft below a row when Enter commits its edit", () => {
    function Editable() {
      const [items, setItems] = useState<ChecklistNode[]>([
        { id: "a", label: "A", checked: false },
      ]);
      const seq = useRef(0);
      return (
        <Checklist
          items={items}
          onChange={setItems}
          editable
          onAdd={(label, position) => {
            const id = `new-${(seq.current += 1)}`;
            setItems((cur) =>
              insertNode(cur, { id, label, checked: false }, position),
            );
            return id;
          }}
        />
      );
    }
    render(<Editable />);
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "A!" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    // The rename committed and a fresh draft opened below it.
    expect(screen.getByRole("button", { name: "A!" })).toBeDefined();
    const draft = screen.getByRole("textbox");
    fireEvent.change(draft, { target: { value: "B" } });
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(screen.getByRole("button", { name: "B" })).toBeDefined();
  });

  it("backspacing an empty row removes it and edits the row above at the end", () => {
    function Editable() {
      const [items, setItems] = useState<ChecklistNode[]>([
        { id: "a", label: "Alpha", checked: false },
        { id: "b", label: "Beta", checked: false },
      ]);
      return <Checklist items={items} onChange={setItems} editable />;
    }
    render(<Editable />);
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    // "Beta" is gone and "Alpha" is now being edited, caret at its end.
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
    const prev = screen.getByRole("textbox") as HTMLInputElement;
    expect(prev.value).toBe("Alpha");
    expect(prev.selectionStart).toBe("Alpha".length);
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
