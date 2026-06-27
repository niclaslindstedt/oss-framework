<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/hooks`

Framework-agnostic React hooks — the small, dependency-free interaction
primitives both source apps had grown their own byte-identical copies of. They
own **behaviour**, not markup: a hook hands back state and event handlers; your
component decides what to render with them.

| Export                 | What it is                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `useEscapeKey`         | Calls `onEscape` on Escape while `enabled`, in the capture phase (nested-dropdown friendly). |
| `useMediaQuery`        | Subscribe to a CSS media query; re-renders when it flips. Reads the initial value in sync.   |
| `useDesktopPointer`    | `true` on a precise, hovering pointer (mouse/trackpad) — gate right-click affordances.       |
| `useRowSwipe`          | A swipe-to-reveal / swipe-to-dismiss gesture for a list row.                                 |
| `usePullToRefresh`     | A touch pull-to-refresh gesture at the top of a scroll region; fires an async `onRefresh`.   |
| `useUndoRedoShortcuts` | Global Cmd/Ctrl+Z · Cmd/Ctrl+Shift+Z / Ctrl+Y bound to a document-level history.             |
| `useLongPress`         | Press-and-hold gesture: fires past a delay, cancels on a drag, swallows the trailing tap.    |

These are the leaf of the dependency graph: hooks import nothing from the
feature modules, so pulling `/hooks` never drags the rest of the framework in.
`react` is a peer dependency.

## `useMediaQuery`

Subscribe a component to a CSS media query. Returns whether the query matches
right now and re-renders when it flips. The initial value is read
**synchronously**, so the first paint is already correct — no flash of the
wrong layout — and it then tracks the `MediaQueryList`'s own `change` event
(cheaper and more accurate than listening to `resize` and re-measuring). It is
SSR-safe: with no `window`/`matchMedia` it reports `false` and never
subscribes.

```tsx
import { useMediaQuery } from "@niclaslindstedt/oss-framework/hooks";

// Derive a responsive layout flag the app owns and passes into the shell.
const pinned = useMediaQuery("(min-width: 768px)");
```

`useDesktopPointer()` is a named query for the common case: `true` on a device
with a precise, hovering pointer — a mouse or trackpad — and `false` on a
coarse touch screen. Use it to gate affordances that need a real secondary
click, chiefly right-click context menus; touch devices keep their swipe/tap
affordances instead. A hybrid (a touch laptop) reports `hover: hover` and opts
into both.

```tsx
import { useDesktopPointer } from "@niclaslindstedt/oss-framework/hooks";

const desktopPointer = useDesktopPointer();
// e.g. only wire `Checklist`'s `onRowContextMenu` when there's a real
// secondary click to invoke it.
```

### Migrating an existing media-query hook

A hand-rolled copy is almost always identical — delete it and import this one.
Two things to check as you switch:

- **Initial-value timing.** If your old copy initialised to `false` and only
  corrected in an effect, you had a first-paint flash; this hook reads the
  match in the `useState` initialiser, so that flash is gone (no action
  needed). If you intentionally relied on the false-first behaviour, note the
  change.
- **A separate desktop-pointer helper.** If you kept a second hook for
  `(hover: hover) and (pointer: fine)`, replace it with `useDesktopPointer`
  rather than re-deriving the query string.

## `useRowSwipe`

A horizontal swipe gesture for one list row, distilled from the row-swipe both
apps shipped. It arms only on a **dominant horizontal** drag (so vertical list
scrolling is never hijacked), then drives a live transform with two outcomes:

- **swipe left** → latch the foreground open to uncover a trailing action (a
  Delete button, say) — a deliberate two-step, so a destructive tap is never one
  flick.
- **swipe right** → fire `onDismiss` once past the threshold; the foreground
  slides off and you drop the row on the next render. Omit `onDismiss` and the
  right swipe has no outcome — it rubber-bands and snaps back, for a row that
  offers the left reveal alone.

> Reaching for the markup too? The components `SwipeableRow` wraps this hook
> with the strip, the archive backdrop, and the mobile-gesture tags already
> wired — reach for the hook directly only when you need a custom row shape.

```tsx
import { useRowSwipe } from "@niclaslindstedt/oss-framework/hooks";

function Row({ onDelete }: { onDelete: () => void }) {
  const swipe = useRowSwipe(onDelete);
  return (
    <li className="relative overflow-hidden">
      {/* Action strip behind, uncovered as the foreground slides left. */}
      <div
        aria-hidden={swipe.offset >= 0}
        className={`absolute inset-0 flex justify-end ${swipe.offset < 0 ? "" : "invisible"}`}
      >
        <button onClick={onDelete} className="w-24 bg-danger text-white">
          Delete
        </button>
      </div>

      {/* Foreground: spread the handlers, apply the transform, gate the CSS
          transition on `animating` so only the settle / slide-off animates. */}
      <div
        {...swipe.handlers}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        className={`bg-page-bg [touch-action:pan-y] ${swipe.animating ? "transition-transform" : ""}`}
      >
        …row content…
      </div>
    </li>
  );
}
```

The hook returns `{ offset, animating, open, close, handlers }`. The foreground
must carry an **opaque background** so the action strip stays hidden until the
row is swiped its way, and `[touch-action:pan-y]` so the browser still scrolls
the list vertically. The pixel thresholds default to the apps' values and are
overridable:

```ts
useRowSwipe(onDismiss, {
  actionWidth: 96, // the strip width the left-latch rests open at
  openAt: 48, // left-swipe distance that latches open
  dismissAt: 96, // right-swipe distance that fires onDismiss
  axisLock: 8, // movement before committing to an axis
  dismissMs: 180, // slide-off duration before onDismiss fires (match your CSS)
});
```

> Already wired into [`Checklist`](../checklist/README.md): pass it `onDelete`
> and it builds the strip/foreground above for you. Reach for the bare hook when
> your row needs something `Checklist` doesn't model — a second swipe direction,
> a non-checklist row, a custom action.

### Migrating an existing swipe

- **Single trailing action (delete / archive).** Drop your hand-rolled
  pointer-tracking for `useRowSwipe`; map your reveal/commit thresholds onto the
  `options`. The hook already swallows the click that trails a drag, so a swipe
  never also activates a control inside the row.
- **Two actions, one per direction.** The hook latches **left** and dismisses
  **right**. If you revealed a different action each way, keep that bespoke row
  in your app — `useRowSwipe` is the one-action shape.
- **Touch-only in your app.** The hook is pointer-based, so it also responds to a
  mouse drag. Gate it yourself (e.g. a pointer-type / coarse-pointer check) if
  you only want it on touch.

### Verifying `useRowSwipe`

- A vertical drag scrolls the list; it never moves the row or fires `onDismiss`.
- A short swipe settles back to `offset: 0`; a left swipe past `openAt` rests at
  `-actionWidth` with `open: true`; a right swipe past `dismissAt` calls
  `onDismiss` after `dismissMs`.
- A tap that trails a drag is swallowed (the row's own controls don't fire), and
  a tap on an already-open row closes it.

## `usePullToRefresh`

The touch-driven pull-to-refresh both apps grew, distilled to a single hook. It
listens at the **document** level for a downward drag that begins while the
scroll region is at its top, applies rubber-band damping, and fires your async
`onRefresh` once the user crosses the trigger distance and lets go. It owns the
gesture and the state machine only — you render the affordance with
[`PullToRefreshIndicator`](../components/README.md) (or your own markup) from the
`{ state, pullDistance }` it returns.

```tsx
import { usePullToRefresh } from "@niclaslindstedt/oss-framework/hooks";
import { PullToRefreshIndicator } from "@niclaslindstedt/oss-framework/components";

function Screen({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const { state, pullDistance } = usePullToRefresh(onRefresh);
  return (
    <div className="relative">
      <PullToRefreshIndicator state={state} pullDistance={pullDistance} />
      {/* …your scrollable content… */}
    </div>
  );
}
```

`state` walks `idle → pulling → release → refreshing → idle`; `pullDistance` is
the damped travel in px. The gesture is **touch-only** by design (pull-to-refresh
is a mobile idiom) and gates itself three ways so it never fights normal use:

- **Scroll gate** — it arms only when every scrollable ancestor of the touch
  target is at its top, so a mid-scroll drag still scrolls the list.
- **Modal gate** — it stands down while any `[aria-modal="true"]` element is
  mounted, so a drag inside a dialog can't refresh the chrome behind it.
- **Form gate** — a drag that starts on an `input` / `textarea` / `select` /
  `contenteditable` is ignored.

Pass `{ enabled: false }` to suspend it (e.g. while a refresh you triggered some
other way is already running); disabling mid-pull clears any armed indicator.
The shell that hosts the content needs `position: relative` (or a fixed
ancestor) so the indicator — which pins to the top of the visual viewport —
lands in the right place.

### Migrating an existing pull-to-refresh

- **Hand-rolled touch tracking → the hook.** Delete your `touchstart` /
  `touchmove` / `touchend` bookkeeping and the damping math; drive your existing
  indicator off `{ state, pullDistance }` instead. The trigger distance, max
  pull, and resistance are the apps' tuned values and are not currently props —
  if yours differ materially, widen the hook rather than re-implementing it.
- **A spinner-only refresh with no gesture.** Keep your button/menu refresh and
  call the same `onRefresh`; add the hook for the gesture and let both paths
  share the async. Gate the hook with `enabled` off your own in-flight flag so a
  tap and a pull can't overlap.
- **Pointer / mouse pull in your app.** This hook is touch-only on purpose. If
  you supported a mouse drag, that path stays your app's concern.

### Verifying `usePullToRefresh`

- A pull from the top past the trigger flips `state` to `release`; letting go
  fires `onRefresh` and holds `state: "refreshing"` until the promise settles,
  then returns to `idle` with `pullDistance: 0`.
- A short pull (under the trigger) settles back to `idle` without firing.
- An upward drag, a drag inside an open modal, and a drag while mid-scrolled all
  leave `state: "idle"` and never fire `onRefresh`.

## `useUndoRedoShortcuts`

Binds the global undo/redo chords — **Cmd/Ctrl+Z** for undo, **Cmd/Ctrl+Shift+Z**
or **Ctrl+Y** for redo — to a document-level history both apps drove from the same
hand-rolled keyboard handler. It owns the listener only: you keep the history
(an undo/redo store) and pass it `canUndo` / `canRedo` plus the `onUndo` /
`onRedo` steppers.

```tsx
import { useUndoRedoShortcuts } from "@niclaslindstedt/oss-framework/hooks";

function App({ store }: { store: DocStore }) {
  useUndoRedoShortcuts({
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    onUndo: store.undo,
    onRedo: store.redo,
  });
  // …
}
```

It deliberately **bails out while focus is inside an editable element**
(`<input>` / `<textarea>` / `<select>` / `contenteditable`) so the browser's
native field-level undo keeps working as the user types — the global timeline
only steps the document history once focus leaves the text. When a chord does
act, it `preventDefault()`s so the browser doesn't also run its own undo.

`enabled` (default `true`) gates the whole listener. Set it `false` while another
surface owns the keyboard — an open drawer or overlay whose own controls take
over — so a stray Cmd/Ctrl+Z doesn't reach through and mutate the document
behind it:

```tsx
useUndoRedoShortcuts({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  enabled: !drawerOpen || pinned, // silence while a (non-docked) drawer is open
});
```

### Migrating an existing undo/redo binding

- **Hand-rolled `keydown` handler → the hook.** Delete your global listener and
  its modifier/editable-target bookkeeping; wire `canUndo`/`canRedo` and the
  steppers from your store instead. The hook's chord set
  (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y) and editable-element bail-out match the
  common implementation, so behaviour carries over unchanged.
- **History lives in a context / external store.** Fine — the hook holds no
  state. Read `canUndo`/`canRedo` and pass the store's `undo`/`redo` straight
  through; the hook re-subscribes whenever those identities change.
- **You silence shortcuts in some modes.** Funnel that condition through
  `enabled` rather than conditionally calling the hook (Rules of Hooks). A
  docked, always-visible sidebar usually stays enabled; only a transient overlay
  drawer needs silencing.

### Verifying `useUndoRedoShortcuts`

- Cmd/Ctrl+Z calls `onUndo` only when `canUndo`; Cmd/Ctrl+Shift+Z and Ctrl+Y call
  `onRedo` only when `canRedo`; each acting chord prevents the browser default.
- A chord pressed while a text field is focused is ignored (native field undo
  still runs).
- With `enabled: false` no chord fires; flipping it back rebinds the listener.
