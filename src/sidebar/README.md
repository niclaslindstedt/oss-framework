<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/sidebar`

The responsive navigation **shell** for local-first PWAs — the framing that
both the `notes` and `checklist` apps grew, byte-for-byte alike, around very
different navigation content. It collapses to a draggable floating button and a
swipe-dismissable drawer on phones, and docks open as a permanent sidebar on
wide screens, while the host supplies the rows that go inside it.

```tsx
import {
  Sidebar,
  useSidebarInset,
  type MenuButtonPosition,
} from "@niclaslindstedt/oss-framework/sidebar";

function AppShell() {
  const pinned = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuButtonPosition>({
    side: "left",
    y: 0.5,
  });

  // Optional: publish the docked width so a route-level fixed overlay
  // (e.g. a toast) can centre over the content rather than the window.
  useSidebarInset(pinned, position.side);

  return (
    <div className="flex">
      <Sidebar
        pinned={pinned}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onClose={() => setOpen(false)}
        position={position}
        onPositionChange={setPosition}
      >
        {/* your navigation content: list, action bar, footer … */}
        <NavSections />
      </Sidebar>
      <main className="flex-1">{/* … */}</main>
    </div>
  );
}
```

## What the framework owns vs. what stays in your app

| Owned here (shared)                                                          | Stays in your app (app-specific)                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The docked-vs-drawer framing, backdrop, slide-in, and Escape/swipe dismissal | The **nav content** (note / checklist list, action bars, footer) — `children` |
| The draggable floating button + its snap-to-edge geometry (`position.ts`)    | The **nav state store** (where `open` / `position` / `pinned` live & sync)    |
| `useDraggableMenuButton`, `useDrawerSwipeClose`, `useSidebarInset`           | Deciding `pinned` (a media query) and laying out the docked flex sibling      |
| The `MenuButtonPosition` shape (edge + 0..1 vertical fraction)               | The CSS token values and the drawer keyframes (see below)                     |

The **state is deliberately not part of this module.** An app's nav state is
usually fused with concerns the framework knows nothing about (the active view,
undo/redo counts, a synced settings doc). The framework gives you the framing
and the geometry; you keep owning _where the user's choice lives_ and thread it
in as props. The shell itself is stateless.

## `Sidebar` props

| Prop               | Type                          | Default | Notes                                                                     |
| ------------------ | ----------------------------- | ------- | ------------------------------------------------------------------------- |
| `pinned`           | `boolean`                     | —       | Docked permanent sidebar when true; the floating-button drawer otherwise. |
| `open`             | `boolean`                     | —       | Whether the drawer is open. Ignored when `pinned`.                        |
| `onToggle`         | `() => void`                  | —       | The floating button's press.                                              |
| `onClose`          | `() => void`                  | —       | Backdrop tap, Escape, or swipe.                                           |
| `position`         | `MenuButtonPosition`          | —       | The button's persisted resting spot (`{ side, y }`).                      |
| `onPositionChange` | `(next) => void`              | —       | Persist a new resting spot after a drag.                                  |
| `onDraggingChange` | `(dragging: boolean) => void` | —       | Fires while the button is mid-drag (gate global gestures).                |
| `showButton`       | `boolean`                     | `true`  | Render the floating open button.                                          |
| `swipeToClose`     | `boolean`                     | `false` | Enable drag-back-to-close on the drawer.                                  |
| `panelScroll`      | `boolean`                     | `true`  | Panel scrolls itself (`true`) vs. children own the scroll (`false`).      |
| `labels`           | `Partial<SidebarLabels>`      | English | Accessible strings (`nav`, `open`, `close`).                              |
| `children`         | `ReactNode`                   | —       | The navigation content.                                                   |

`MenuButtonPosition` is `{ side: "left" | "right"; y: number }` where `y` is a
`0..1` fraction of the vertical travel, so a saved spot survives viewport
resizes. The docked sidebar and the floating button both sit on `position.side`.

### Swipe-to-close

With `swipeToClose`, a horizontal drag of the drawer back toward its resting
edge dismisses it (past 40% of the panel width, or on a flick); a shorter drag
snaps back open, and a vertical drag still scrolls the panel. A nav row that
owns its _own_ horizontal swipe (reveal-to-delete, swipe-to-archive) should tag
its swipeable element `data-drawer-swipe-ignore` so the drawer swipe stands
down while the finger is on it.

## Styling contract

The shell paints with the framework's semantic colour slots and a few drawer
keyframes the host must define — the same way the other framework components
expect `bg-surface` / `border-line` / `text-fg` to be wired through the app's
token system.

**Colour / token utilities used:** `bg-surface`, `border-line`, `text-muted`,
`text-fg-bright`, plus the `--density-row-py` CSS variable (footer padding) and
the optional `--app-top` / `--app-height` (the drawer overlay tracks these when
set, e.g. to follow the iOS soft keyboard).

**Drawer keyframes the app supplies** (the shell only references the classes):

```css
@keyframes drawer-slide-in-left {
  from {
    transform: translateX(-100%);
  }
}
@keyframes drawer-slide-in-right {
  from {
    transform: translateX(100%);
  }
}
@keyframes drawer-backdrop-in {
  from {
    opacity: 0;
  }
}
.drawer-panel-left {
  animation: drawer-slide-in-left 300ms ease-out;
}
.drawer-panel-right {
  animation: drawer-slide-in-right 300ms ease-out;
}
.drawer-backdrop {
  animation: drawer-backdrop-in 300ms ease-out;
}
```

A `prefers-reduced-motion` rule that zeroes these animations is the app's call.

## `useSidebarInset(pinned, side)`

Publishes the pinned sidebar's 16rem footprint to `--app-content-left` /
`--app-content-right` on `<html>` (zero on the other edge, zero when not
pinned, cleared on unmount). A route-level `position: fixed` overlay rendered
_outside_ the app's flex layout — a toast on every route, say — can then read
`var(--app-content-left, 0px)` to centre over the content area rather than the
whole window.
