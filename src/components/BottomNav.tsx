// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

// A row of destinations pinned to the bottom of the screen.
//
// The counterpart to `Sidebar`, for the shape of app that has a handful of
// places rather than hundreds of items in folders. A sidebar has to be opened
// before it can be used; a bottom bar is already under the thumb, which is
// what a one-handed app used in short bursts wants.
//
// The bar carries *destinations* — places you are, in a fixed left-to-right
// order that means something. Actions (a thing you do and then leave) belong
// on a top bar instead: they have no position in that order, and giving them
// one costs the order its meaning. That is not a style note; it is what makes
// `stepDirection` below well-defined, and with it the swipe (`useSwipeNav`)
// and the screen transition that has to agree with the finger.
//
// The active item may be one the bar does not carry — a screen reached from
// elsewhere — in which case no tab is current and the bar says so by lighting
// none of them, rather than by leaving a stale one lit.

/** One destination on the bar. */
export type BottomNavItem<Id extends string = string> = {
  id: Id;
  /** The word under the icon. Also the button's accessible name. */
  label: string;
  /** The glyph, as a component taking a `className` — the shape every icon in
   *  `components/icons.tsx` already has. */
  icon: (props: { className?: string }) => ReactNode;
  /** A count or status chip on the tab, rendered over the icon's corner. */
  badge?: ReactNode;
};

/** Which way a screen arriving from `from` should travel: `forward` in from
 *  the right, `back` in from the left, `none` for a change with no direction
 *  to it. */
export type StepDirection = "forward" | "back" | "none";

/**
 * How a move from one place to another sits on an ordered axis.
 *
 * The bar's order is an app's one left-to-right claim, and a swipe already
 * moves along it — so a screen has to arrive from the side the gesture came
 * from, or the motion contradicts the finger that asked for it. The same
 * order answers a *tap* two tabs along, because that is the same move as two
 * swipes and should not look like a different one.
 *
 * `none` for anything off the axis, and that is a claim rather than a
 * fallback: a screen that is not on the bar has no neighbours, and sliding it
 * in from a side invents a position for it that the rest of the app then has
 * to keep pretending is there. A cross-fade is a change of screen without a
 * direction, which is exactly what pressing a top-bar button is.
 */
export function stepDirection<Id>(
  order: readonly Id[],
  from: Id,
  to: Id,
): StepDirection {
  if (from === to) return "none";
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a === -1 || b === -1) return "none";
  return b > a ? "forward" : "back";
}

export type BottomNavProps<Id extends string = string> = {
  items: readonly BottomNavItem<Id>[];
  /** The place on display. Typed wider than `Id` on purpose: it may well be a
   *  screen the bar does not carry, and then no tab is current. */
  active: string;
  onSelect: (id: Id) => void;
  /** Accessible name for the bar — an app has one navigation, so this is
   *  usually the app's own name. */
  label?: string;
  /** Cap the row's width on a wide viewport so the tabs stay thumb-sized
   *  rather than stretching to a desktop's full width. Default
   *  `"max-w-2xl"`; pass `""` to fill. */
  maxWidthClass?: string;
  className?: string;
};

/**
 * The bar. One `<nav>` with a list of buttons — no router, no history, no
 * opinion about what selecting a destination does: `onSelect` is handed the
 * id and the app decides.
 *
 * Positioning is left to the app's own layout (the bar is the last flex child
 * of a column, or is fixed by the app's stylesheet), and so is the safe-area
 * inset under it: how much of a phone's home indicator to clear is a judgement
 * about the app's density, not something a component can know.
 */
export function BottomNav<Id extends string = string>({
  items,
  active,
  onSelect,
  label,
  maxWidthClass = "max-w-2xl",
  className = "",
}: BottomNavProps<Id>) {
  return (
    <nav
      aria-label={label}
      className={`shrink-0 border-t border-line bg-surface-3 ${className}`.trim()}
    >
      <ul className={`mx-auto flex ${maxWidthClass}`.trim()}>
        {items.map((item) => {
          const Icon = item.icon;
          const on = item.id === active;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={on ? "page" : undefined}
                className={`flex w-full cursor-pointer flex-col items-center gap-0.5 py-2 text-[0.7rem] transition-colors ${
                  on ? "text-accent" : "text-muted hover:text-fg"
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="pointer-events-none absolute -top-1 -right-2">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
