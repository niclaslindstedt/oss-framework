// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { applyOrder, moveInOrder, orderOf } from "../src/order/order.ts";

const ITEMS = [
  { id: "pencil" },
  { id: "eraser" },
  { id: "fill" },
  { id: "text" },
];
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);

describe("moveInOrder", () => {
  const order = ["a", "b", "c", "d"];

  it("moves one id and closes the gap behind it", () => {
    expect(moveInOrder(order, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveInOrder(order, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("leaves the input alone", () => {
    moveInOrder(order, 0, 3);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("is a no-op for a move to where it already is", () => {
    expect(moveInOrder(order, 1, 1)).toEqual(order);
  });

  it("is a no-op for an out-of-range index rather than an error", () => {
    expect(moveInOrder(order, -1, 2)).toEqual(order);
    expect(moveInOrder(order, 1, -1)).toEqual(order);
    expect(moveInOrder(order, 9, 0)).toEqual(order);
    expect(moveInOrder(order, 0, 9)).toEqual(order);
  });

  it("copes with an empty order", () => {
    expect(moveInOrder([], 0, 0)).toEqual([]);
  });
});

describe("applyOrder", () => {
  it("deals the named ids back into the slots they occupy", () => {
    expect(ids(applyOrder(ITEMS, ["eraser", "pencil"]))).toEqual([
      "eraser",
      "pencil",
      "fill",
      "text",
    ]);
  });

  it("keeps an entry the stored order predates where it was registered", () => {
    // "fill" isn't named, so it stays third whatever the other two do.
    expect(ids(applyOrder(ITEMS, ["text", "eraser", "pencil"]))).toEqual([
      "text",
      "eraser",
      "fill",
      "pencil",
    ]);
  });

  it("drops an id this build no longer has", () => {
    expect(ids(applyOrder(ITEMS, ["gone", "fill", "pencil"]))).toEqual([
      "fill",
      "eraser",
      "pencil",
      "text",
    ]);
  });

  it("drops a duplicate rather than leaving a hole", () => {
    const out = applyOrder(ITEMS, ["fill", "fill", "pencil"]);
    expect(ids(out)).toEqual(["fill", "eraser", "pencil", "text"]);
    expect(out).toHaveLength(ITEMS.length);
  });

  it("hands back the registered order for an empty or unknown order", () => {
    expect(ids(applyOrder(ITEMS, []))).toEqual(ids(ITEMS));
    expect(ids(applyOrder(ITEMS, ["nope", "gone"]))).toEqual(ids(ITEMS));
  });

  it("never loses or invents an entry", () => {
    const out = applyOrder(ITEMS, ["text", "pencil"]);
    expect([...ids(out)].sort()).toEqual([...ids(ITEMS)].sort());
  });

  it("is idempotent through orderOf", () => {
    const once = applyOrder(ITEMS, ["text", "eraser"]);
    const twice = applyOrder(ITEMS, orderOf(once));
    expect(ids(twice)).toEqual(ids(once));
  });

  it("leaves the input alone", () => {
    applyOrder(ITEMS, ["text", "pencil"]);
    expect(ids(ITEMS)).toEqual(["pencil", "eraser", "fill", "text"]);
  });
});

describe("orderOf", () => {
  it("is the list of ids", () => {
    expect(orderOf(ITEMS)).toEqual(["pencil", "eraser", "fill", "text"]);
  });
});
