// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public order surface — the arithmetic of a **stored arrangement**: a list of
// ids persisted alongside a set of entries the build owns, applied back onto
// whatever entries this build happens to ship. Pure, DOM-free, and the one
// place the "an id this build doesn't know" / "an entry the order predates"
// rules are written down.
export { moveInOrder, applyOrder, orderOf } from "./order.ts";
