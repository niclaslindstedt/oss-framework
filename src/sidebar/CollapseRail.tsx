// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// The two collapse rails a docked sidebar folds itself away with — chevron-only
// controls that read as part of the panel's chrome rather than as buttons
// competing with its content.
//
// `SidebarCollapseRail` rides the inner edge of the docked panel and folds the
// whole thing away; `CollapseRail` is its horizontal twin, a full-width strip
// that folds whatever sits below it (a footer, a section) and hands the freed
// rows back to the list above.

import { useRef, type RefObject } from "react";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "../components/icons.tsx";
import { useDesktopPointer } from "../hooks/useMediaQuery.ts";
import { useEdgeHover } from "../hooks/useEdgeHover.ts";

/** The docked `Sidebar` panel's own width (its `w-64`). */
export const SIDEBAR_PANEL_WIDTH = "16rem";

/**
 * The width of the rail that reveals itself on the panel's inner edge (`w-4`).
 * Wide enough to hover and press without a precise aim, narrow enough to read
 * as a grip on the divider rather than a second panel. It is an overlay, so it
 * is never part of the sidebar's footprint.
 */
export const SIDEBAR_RAIL_WIDTH = "1rem";

export type CollapseRailProps = {
  /** Whether the thing below the rail is currently folded away. */
  collapsed: boolean;
  /**
   * The rail is the panel's last child (what it collapses is folded away), so
   * it owns the bottom breathing room that content would otherwise carry —
   * including the home-indicator inset.
   */
  last?: boolean;
  /** Accessible name / tooltip — "Hide details" or "Show details". */
  label: string;
  onClick: () => void;
};

/**
 * A thin chevron rail seated above the section it folds: a full-width button
 * one line tall. Tapping it folds that section away to give the list above
 * more room, and again to bring it back. The chevron points down to collapse
 * (fold out of view) and up to restore.
 */
export function CollapseRail({
  collapsed,
  last = false,
  label,
  onClick,
}: CollapseRailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className={`flex w-full shrink-0 cursor-pointer items-center justify-center border-t border-line pt-[calc(var(--density-row-py)+0.25rem)] text-muted hover:bg-surface-2 hover:text-fg-bright ${
        last
          ? "pb-[max(calc(var(--density-row-py)+0.25rem),env(safe-area-inset-bottom))]"
          : "pb-[calc(var(--density-row-py)+0.25rem)]"
      }`}
    >
      {collapsed ? (
        <ChevronUpIcon className="h-4 w-4" />
      ) : (
        <ChevronDownIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export type SidebarCollapseRailProps = {
  /** Whether the sidebar is currently folded away. */
  collapsed: boolean;
  /** Which edge of the viewport the sidebar docks on. */
  side: "left" | "right";
  /** Accessible name / tooltip — "Hide sidebar" or "Show sidebar". */
  label: string;
  /**
   * How far in from `side` the rail's band starts, as a CSS length. Defaults
   * to the framework `Sidebar`'s own geometry: flush with the viewport edge
   * while collapsed (where a cursor thrown at the side of the screen lands on
   * it without aiming), straddling the panel's inner edge while docked. Pass
   * your own for a shell whose panel is not `SIDEBAR_PANEL_WIDTH` wide.
   */
  offset?: string;
  /**
   * Keep the grip drawn and pressable at all times, rather than only while the
   * pointer is over its band. Off by default; a device with no hover already
   * gets this behaviour, since it could otherwise never bring a collapsed
   * sidebar back.
   */
  alwaysVisible?: boolean;
  onClick: () => void;
};

// The vertical twin of `CollapseRail`: the control seated on the *inner* edge
// of the docked sidebar (the edge that faces the app), which folds the whole
// panel away and brings it back. Only a docked layout has one — a phone drawer
// closes instead of collapsing.
//
// It costs the layout nothing, and at rest it costs the *pointer* nothing
// either. Two nested pieces do that:
//
// - The `<button>` itself is a full-height, invisible sensor straddling the
//   edge, and is `pointer-events-none` for its whole life. `useEdgeHover`
//   measures its box against the cursor to decide whether it is revealed —
//   which is why it can be click-through and still know when it is being
//   approached, something plain `:hover` can't do.
// - The grip inside it is the only thing ever drawn or pressed, and only once
//   revealed turns its opacity and its pointer events back on together. A
//   descendant may take pointer events back from a `none` ancestor, and the
//   press still bubbles to the button's handler.
//
// The grip fills the sensor: a `w-4` strip running the panel's whole height,
// so wherever along the edge the pointer arrives it is already on the control
// rather than hunting up or down for a small handle.
//
// Running that tall, it has to be quiet: no border and no shadow — just a flat
// `surface-3` strip over the divider, with the chevron muted at its centre.
// The fill is opaque rather than a translucent wash so the strip reads as one
// solid control at any panel width, over any theme, instead of picking up
// whatever it happens to sit on. Hovering it directly fills it with
// `surface-2` — the tone the panel's own rows take on hover — and brightens
// the chevron, which is the moment it has to read unmistakably as a button.
// The chevron points the way the panel will move (out toward the edge to
// collapse, in toward the app to restore). `title` keeps it discoverable for a
// pointer that pauses there; keyboard focus reveals it on its own terms (a
// focused button takes Enter without needing pointer events at all), and
// `aria-expanded` keeps it legible to a screen reader either way.
export function SidebarCollapseRail({
  collapsed,
  side,
  label,
  offset,
  alwaysVisible = false,
  onClick,
}: SidebarCollapseRailProps) {
  // The rail draws itself only while the pointer is over its own box. A device
  // that can't hover would never see it at all — and, once collapsed, would
  // have no way back — so there it stays up.
  const railRef: RefObject<HTMLButtonElement | null> =
    useRef<HTMLButtonElement>(null);
  const hoverCapable = useDesktopPointer();
  const hovering = useEdgeHover(railRef, hoverCapable && !alwaysVisible);
  const revealed = alwaysVisible || !hoverCapable || hovering;
  // Collapsed on the left edge, the way back in is rightward; docked on the
  // right, every direction mirrors.
  const pointsRight = side === "left" ? collapsed : !collapsed;
  const band =
    offset ??
    (collapsed
      ? "0px"
      : `calc(${SIDEBAR_PANEL_WIDTH} - ${SIDEBAR_RAIL_WIDTH} / 2)`);
  return (
    <button
      ref={railRef}
      type="button"
      onClick={(e) => {
        // A pressed rail keeps focus, and the first key typed afterwards
        // promotes that focus to `:focus-visible` — which lights the rail's
        // ring down the whole edge of the screen on every keystroke the app
        // takes. `detail > 0` is a genuine pointer press (keyboard activation
        // reports 0), so the ring still belongs to anyone who tabbed here.
        if (e.detail > 0) e.currentTarget.blur();
        onClick();
      }}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      style={{ [side]: band }}
      className="group pointer-events-none absolute inset-y-0 z-40 flex w-4 items-center justify-center focus-visible:outline-none"
    >
      <span
        className={`flex h-full w-full items-center justify-center text-muted transition-[opacity,background-color,color] duration-150 group-focus-visible:bg-surface-2 group-focus-visible:text-fg-bright group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-inset motion-reduce:transition-none ${
          revealed
            ? "pointer-events-auto cursor-pointer bg-surface-3 opacity-100 hover:bg-surface-2 hover:text-fg-bright"
            : "opacity-0"
        }`}
      >
        {pointsRight ? (
          <ChevronRightIcon className="h-4 w-4" />
        ) : (
          <ChevronLeftIcon className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}
