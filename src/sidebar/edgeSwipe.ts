// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { MenuButtonSide } from "./position.ts";

// The edge swipe's arithmetic, on its own — the pure half of
// `useEdgeSwipeOpen`.
//
// The hook recognises the gesture from a document-level touch listener, which
// is everything an ordinary app needs. An app whose main surface handles its
// own pointer stream needs more than that: the same swipe lands on a canvas, a
// map, a board, and *that* surface has to know the gesture is not its own
// before it acts on the press. It cannot ask the hook what it is thinking, so
// without these it copies the two numbers and the "a vertical drag is not a
// swipe" rule into its own file — where the copy is one release away from
// disagreeing with the hook and leaving a stroke across the page behind an
// opening drawer.
//
// So the rule is exported rather than mirrored. The press is **held** while
// {@link classifyEdgeDrag} says `pending`, released to the surface on `press`,
// and dropped on `menu` — nothing is lost by the wait, because a held press is
// replayed from where it began.

/** How close to the border (px) a touch must start to count as an edge swipe.
 *  `useEdgeSwipeOpen`'s `edgeZone` default. */
export const EDGE_ZONE_PX = 30;

/** Inward travel (px) the finger must cover before the drawer opens.
 *  `useEdgeSwipeOpen`'s `openDistance` default. */
export const EDGE_OPEN_DISTANCE_PX = 48;

/** Whether a press at `x` (in viewport coordinates, on a viewport `width`
 *  wide) begins in the strip the drawer watches. */
export function inEdgeZone(
  x: number,
  width: number,
  side: MenuButtonSide,
  zone = EDGE_ZONE_PX,
): boolean {
  return side === "left" ? x <= zone : x >= width - zone;
}

/** What a held press has turned out to be:
 *
 *  - `pending` — still undecided; keep holding.
 *  - `press` — not the drawer's swipe, so it is the surface's press after all.
 *  - `menu` — the inward swipe fired and the drawer is opening; drop it. */
export type EdgeVerdict = "pending" | "press" | "menu";

/** Classify a held press from how far it has travelled since it landed.
 *
 *  A drag that is more vertical than horizontal is never the drawer's — the
 *  hook disarms on exactly that test — so it is released to the surface at
 *  once. Otherwise it stays held until it has gone far enough inward to open
 *  the drawer; short of that it is still anyone's, and the finger lifting
 *  decides. */
export function classifyEdgeDrag(
  dx: number,
  dy: number,
  side: MenuButtonSide,
  openDistance = EDGE_OPEN_DISTANCE_PX,
): EdgeVerdict {
  if (Math.abs(dy) > Math.abs(dx)) return "press";
  const inward = side === "left" ? dx : -dx;
  return inward >= openDistance ? "menu" : "pending";
}
