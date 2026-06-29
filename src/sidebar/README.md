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

| Owned here (shared)                                                                          | Stays in your app (app-specific)                                              |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The docked-vs-drawer framing, backdrop, slide-in, and Escape/swipe dismissal                 | The **nav content** (note / checklist list, action bars, footer) — `children` |
| The draggable floating button (`FloatingButton`) + its snap-to-edge geometry (`position.ts`) | The **nav state store** (where `open` / `position` / `pinned` live & sync)    |
| `useDraggableMenuButton`, `useDrawerSwipeClose`, `useEdgeSwipeOpen`, `useSidebarInset`       | Deciding `pinned` (a media query) and laying out the docked flex sibling      |
| `useDragDrop` — the gesture + hit-testing behind dragging nav rows between targets           | What a drag _means_ (`canDrop` / `onDrop`) and the row / highlight chrome     |
| The `MenuButtonPosition` shape (edge + 0..1 vertical fraction)                               | The CSS token values and the drawer keyframes (see below)                     |

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
down while the finger is on it. The components `SwipeableRow` already carries
this tag, so a nav row built from it composes inside a `swipeToClose` drawer
with no extra wiring.

### Open with an edge swipe (`useEdgeSwipeOpen`)

When an app **hides the floating button** (a "swipe to open" preference, a
phone-only PWA where the button gets in the way), `useEdgeSwipeOpen` is the way
back in: a touch that starts at the drawer's resting edge and travels inward
opens it — the mirror of `useDrawerSwipeClose`. Pass `showButton={false}` to the
`Sidebar` and wire the hook in the same shell:

```tsx
const swipeToOpen = !pinned && menuMode === "swipe";

useEdgeSwipeOpen({
  side: position.side, // watch whichever edge the drawer rests on
  enabled: swipeToOpen && !open, // only while closed, and only in swipe mode
  onOpen: () => setOpen(true),
});

<Sidebar
  pinned={pinned}
  open={open}
  showButton={!pinned && !swipeToOpen}
  position={position}
  /* … */
>
```

The hook is **touch-only by design** — an edge swipe is a phone gesture, and an
app typically only offers it in the installed PWA, where the browser's own
back-swipe isn't competing for the same edge. It attaches document-level
listeners once and reads the latest `side`/`enabled` each event, stands down
while a `[aria-modal="true"]` element is open, and ignores a mostly-vertical
drag so a scroll is never hijacked. The thresholds default to a 30px edge zone
and 48px of inward travel; override `edgeZone` / `openDistance` if your app's
feel differs. The host owns the open state and the resting-side choice; the hook
only recognises the gesture and calls `onOpen`.

## `FloatingButton` — the draggable FAB on its own

The round, edge-resting button `Sidebar` floats for its menu toggle is exported
on its own as `FloatingButton`, so an app can pin a **second** global action the
user reaches from anywhere on a phone — opening Settings, a composer, a search —
from the same primitive. Each instance carries its own `position`, so they rest
(and drag) independently; give them opposite default sides so they don't stack.

```tsx
import { FloatingButton } from "@niclaslindstedt/oss-framework/sidebar";

const [pos, setPos] = useState<MenuButtonPosition>({ side: "right", y: 0.5 });

<FloatingButton
  position={pos}
  onPositionChange={setPos}
  onPress={() => setSettingsOpen(true)}
  haspopup="dialog"
  expanded={settingsOpen}
  label="Open settings"
>
  <CogIcon className="h-5 w-5" />
</FloatingButton>;
```

| Prop               | Type                          | Notes                                                          |
| ------------------ | ----------------------------- | -------------------------------------------------------------- |
| `position`         | `MenuButtonPosition`          | Persisted resting spot (`{ side, y }`).                        |
| `onPositionChange` | `(next) => void`              | Persist a new spot after a drag.                               |
| `onPress`          | `() => void`                  | A genuine tap — the trailing click after a real drag is eaten. |
| `onDraggingChange` | `(dragging: boolean) => void` | Fires while mid-drag (gate global gestures).                   |
| `label`            | `string`                      | Accessible label (the content is an icon).                     |
| `expanded`         | `boolean`                     | `aria-expanded` for a button that toggles an overlay.          |
| `controls`         | `string`                      | `aria-controls` — the overlay's id, while open.                |
| `haspopup`         | `aria-haspopup`               | The kind of overlay (`"menu"`, `"dialog"`, …).                 |
| `children`         | `ReactNode`                   | The icon.                                                      |

It is a `position: fixed`, `z-40`, `h-11 w-11` disc on `bg-surface` / `border-line`
— the same look the `Sidebar` toggle wears. To open it by an **edge swipe**
instead (a "swipe to open" preference), hide it and wire `useEdgeSwipeOpen` the
same way the menu does, watching `position.side`.

## Remember the resting spot (`usePersistentMenuPosition`)

The shell is controlled — it never persists the `position` itself, because the
host usually needs the value too (`useSidebarInset` and `useEdgeSwipeOpen` both
read `position.side`). But _wiring up_ that persistence is the same localStorage
boilerplate in every app, so the module ships it as a drop-in for the `useState`
you'd otherwise hold the position in:

```tsx
import {
  Sidebar,
  usePersistentMenuPosition,
} from "@niclaslindstedt/oss-framework/sidebar";

// Was: const [position, setPosition] = useState<MenuButtonPosition>({ … });
const [position, setPosition] = usePersistentMenuPosition(
  "myapp:menu-position",
);

<Sidebar position={position} onPositionChange={setPosition} /* … */ />;
```

It hydrates from `localStorage[storageKey]` on mount (validating the stored
shape, falling back to the default `{ side: "left", y: 0.5 }` — override with the
second `initial` argument), and writes back on every `onPositionChange`, so the
spot the user drags the button to survives a reload. It's SSR-safe (no `window`
access until the first read) and silently tolerates blocked / full storage.

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

## Drag nav rows between targets (`useDragDrop`)

A headless, pointer-driven (touch + mouse + pen) drag-and-drop primitive for the
rows _inside_ the drawer — "drag a checklist into a folder", "drop a folder onto
another workspace", "flick a row onto Archive". It owns only the gesture:
recognising it, tracking the pointer, hit-testing it against the drop zones you
register, and firing `onDrop` with the dragged payload and the target under the
pointer. Every domain decision (what a payload is, which drops are legal, what a
drop _does_) and every pixel of chrome (the drop-zone highlight, the cursor-
following preview) stay in your app.

The **whole row is the drag source** — there's no grip to spend a column on.
`dragHandle` splits the gesture by pointer the way the platform does, so the row
needs no separate affordance:

- **Mouse / pen** — a plain press-and-drag. Travel past `threshold` (default 6px)
  turns the press into a drag; a press that never moves stays the row's click.
- **Touch** — press-and-hold. A drag begins only after the finger is held in
  place for `longPressMs` (default 400ms); any travel before then is a scroll or
  the row's own swipe and abandons the press. Once the hold lifts the row, the
  hook captures the pointer, blocks the panel from scrolling under the finger,
  and swallows the trailing tap so the drop never also activates the row.

It is deliberately **not** the HTML5 drag-and-drop API — that's mouse-only on the
phones these PWAs target. Like the module's other gestures it rides Pointer
Events, capturing the pointer once a drag begins so the move/up stream keeps
flowing as it ranges across the panel. Two generics keep your domain out of the
framework: `TDrag` (what a source carries) and `TTarget` (what a zone represents).

```tsx
type Drag = { kind: "list" | "folder"; id: string };
type Target = { kind: "folder"; id: string } | { kind: "archive" };

const dnd = useDragDrop<Drag, Target>({
  canDrop: (drag, target) => target.kind !== "folder" || drag.kind === "list",
  onDrop: (drag, target) => {
    if (target.kind === "archive") archive(drag.id);
    else moveIntoFolder(drag.id, target.id);
  },
});

// A drag source: spread the handle onto the whole row (it owns the pointer once
// a drag begins, so it rides over the row's tap / swipe without tripping them).
<div {...dnd.dragHandle({ kind: "list", id })}>
  <NavRow>…</NavRow>
</div>;

// A drop zone: attach the ref, light it up from `isOver` / `isActive`.
const z = dnd.dropZone(`folder:${id}`, { kind: "folder", id });
<div ref={z.ref} className={z.isOver ? "ring-2 ring-accent" : ""}>
  …
</div>;

// A cursor-following preview while a drag is live (portal it to the body so it
// rides above the drawer):
{
  dnd.dragging && <Preview item={dnd.dragging} at={dnd.pointer} />;
}
```

Nested zones resolve **innermost-wins** (smallest box containing the pointer), so
a folder zone laid inside a "root" zone claims the drop when the pointer is over
the folder. `dropZone(...).isActive` flags every zone that would accept the drag
in flight (cue all legal targets); `.isOver` flags the one under the pointer.
`onDraggingChange` mirrors the live drag so the host can stand competing global
gestures down for its duration. The demo's `SideMenuContent` wires all of this
into the checklist side menu — a working reference.
