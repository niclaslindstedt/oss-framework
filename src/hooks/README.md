<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/hooks`

Framework-agnostic React hooks — the small, dependency-free interaction
primitives both source apps had grown their own byte-identical copies of. They
own **behaviour**, not markup: a hook hands back state and event handlers; your
component decides what to render with them.

| Export         | What it is                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| `useEscapeKey` | Calls `onEscape` on Escape while `enabled`, in the capture phase (nested-dropdown friendly). |
| `useRowSwipe`  | A swipe-to-reveal / swipe-to-dismiss gesture for a list row.                                 |

These are the leaf of the dependency graph: hooks import nothing from the
feature modules, so pulling `/hooks` never drags the rest of the framework in.
`react` is a peer dependency.

## `useRowSwipe`

A horizontal swipe gesture for one list row, distilled from the row-swipe both
apps shipped. It arms only on a **dominant horizontal** drag (so vertical list
scrolling is never hijacked), then drives a live transform with two outcomes:

- **swipe left** → latch the foreground open to uncover a trailing action (a
  Delete button, say) — a deliberate two-step, so a destructive tap is never one
  flick.
- **swipe right** → fire `onDismiss` once past the threshold; the foreground
  slides off and you drop the row on the next render.

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

## Verification

- A vertical drag scrolls the list; it never moves the row or fires `onDismiss`.
- A short swipe settles back to `offset: 0`; a left swipe past `openAt` rests at
  `-actionWidth` with `open: true`; a right swipe past `dismissAt` calls
  `onDismiss` after `dismissMs`.
- A tap that trails a drag is swallowed (the row's own controls don't fire), and
  a tap on an already-open row closes it.
