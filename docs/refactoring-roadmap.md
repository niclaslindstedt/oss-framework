<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Component-improvement roadmap

The single source of truth for the opportunities to make this framework's
**already-extracted components carry more of their own weight**. Worked via the
`refactor` skill.

## Strategic context — components extracted too lightly

The framework was filled incrementally (the `find-refactor-candidates` skill),
one extraction at a time, each drawing a **seam** between what the component
owns and what stays in the adopting app. That seam is conservative on purpose —
_drop the glue at the seam, leave the store in the app, extract the data + the
pure logic_ — which is right for **domain** coupling. But some seams were drawn
**too far toward the app**: they hand back generic, non-domain responsibility
that **every** green-field adopter then re-implements the same way. That is a
component extracted too lightly, and it is what this roadmap hunts.

The whole judgment is one question, asked of every seam:

> **Would every app that adopts this component write this same code, and is that
> code _not_ domain/business logic?** If yes, the component should own it (as
> default behaviour, overridable) — not hand it back.

**Lift IN** (the component should own it): UI plumbing the caller is forced to
assemble; defaults for props every adopter sets the same way; accessibility /
interaction wiring; timing / anti-flicker orchestration; boilerplate a README
documents as the adopter's job; plumbing duplicated across demo screens.

**Keep OUT** (this stays app-side — the seam working correctly): the store /
where the user's data lives; domain types / entities; business rules;
side-effecting asset imports; app-specific copy beyond an English default. A
candidate that can only be absorbed by dragging one of these across the seam is
**over-extraction** — a rejection, recorded below, not a lift.

Prefer **integrating** a lift into the existing component (a new optional prop, a
new owned default, an extra exported helper) over minting a new primitive; mint
one only when the responsibility is its own concern duplicated across N≥2
components with no clean home.

## Severity rubric

| Band | What to look for                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 9–10 | Every adopter must re-implement a non-trivial, non-domain responsibility the component should own — or a handback so thin the component is barely worth importing. README even documents the boilerplate as the adopter's job. |
| 7–8  | Generic plumbing duplicated across the demo or sibling components; lifting it removes real boilerplate for every adopter.                                                                                                      |
| 5–6  | A required prop that's always the same generic value; a sensible default would simplify adoption.                                                                                                                              |
| 3–4  | Minor convenience: an optional rendered form, a default label, a `prefers-reduced-motion` guard. Cheap, opportunistic.                                                                                                         |
| 1–2  | Cosmetic. Don't add to the roadmap; it'll re-surface if it ever matters.                                                                                                                                                       |

**Fix threshold: 3.** Below it, leave it out. **Hard rejection (0 / skip):** the
responsibility can only be absorbed by importing the store, a domain type, a
business rule, or a side-effecting asset — record it under Investigated-and-
skipped so the next sweep doesn't re-raise it.

## Pending

### Severity 9–10

_(none yet)_

### Severity 7–8

_(none yet)_

### Severity 5–6

- **`components`: a placement-preset shorthand for `FloatingPanel`.**
  - **Files:** `src/components/FloatingPanel.tsx` +
    `src/components/useFloatingPosition.ts`; demo callers re-supply nearly the
    same placement object —
    `demo/src/app/ListAppearancePopover.tsx` (`anchor: "left"`,
    `coordinateSpace: "viewport"`, `width: { kind: "min", … }`),
    `demo/src/app/SettingsModal.tsx`.
  - **Responsibility handed back:** `anchor: "left"` + `coordinateSpace:
"viewport"` + `width.kind: "min"` is the dropdown default every popover
    repeats; only the `minPx` and `gap` really vary. Generic layout config, not
    domain.
  - **Plan:** accept a `placement: FloatingPlacement | "dropdown" | "popover"`
    union with a small preset table; callers pass `"dropdown"` and override
    `minPx`/`gap` only when they differ. Existing object callers unchanged.
  - **Risk:** must re-verify the demo's two panels render pixel-identical under
    the preset; presets that drift from current values would move panels. Verify
    in the running app.
  - **Severity: 5.**

### Severity 3–4

- **`components`: a `rowAction(kind, { label, onSelect })` helper for
  `RowActionMenu`.**
  - **Files:** `src/components/RowActionMenu.tsx`; demo assembles the same
    `{ label, icon: <PencilIcon className="h-5 w-5" />, onSelect }` /
    `{ …, icon: <TrashIcon … />, danger: true }` shapes at
    `demo/src/app/SideMenuContent.tsx` (rename / delete actions, two sites).
  - **Responsibility handed back:** the rename→pencil, delete→trash icon
    pairing, the `h-5 w-5` icon size, and `danger: true` on delete are UI
    conventions every adopter repeats; not domain. The _labels_ stay injected
    (i18n).
  - **Plan:** export a `rowAction("rename" | "delete" | "archive", { label,
onSelect })` factory returning a `RowAction` with the conventional icon +
    danger flag; callers still pass the (translated) label and handler. Raw
    `RowAction` objects stay valid.
  - **Risk:** the framework would own a default icon set — keep it small and
    overridable (a `RowAction` with an explicit `icon` still wins). Don't drag
    app-specific actions in.
  - **Severity: 4.**

### Easy wins (mechanical, any severity)

_(none yet)_

## Landed

- **`components`: an `InlineEditRow` primitive owning the inline rename/create
  editor.** The demo hand-rolled the same in-place text editor twice
  (`FolderEditRow`, `ListEditRow` in `SideMenuContent.tsx`) — byte-identical
  focus-and-select on mount, the Enter/blur-commits-(trimmed)-Escape-cancels
  flow, and the subtle `committed` latch that stops a post-Enter blur from
  firing the callback twice. Lifted all three facets (the focus effect, the
  commit/cancel semantics, the input + shared row shell) into one
  `components/InlineEditRow`; the demo's two editors collapsed to thin chrome
  wrappers that pass only their distinct icon/leading/padding. Takes and returns
  a plain string — no domain entity crosses the seam. New direct unit coverage
  for the focus/commit/cancel/double-fire behaviour. (2026-06, _Severity 7_)
- **`hooks`: one shared modal gate behind all three global gestures.** Replaced
  the three byte-identical `document.querySelector('[aria-modal="true"]') !==
null` probes (`usePullToRefresh`, `useEdgeSwipeOpen`, `useUndoRedoShortcuts`)
  with a single exported `isModalOpen()` leaf helper they all call — one source
  of truth for "is a dialog gating the screen?", so honouring a new marker later
  is a one-line change instead of a three-site hunt. Exported on `.`/`./hooks`
  so an adopter's own document-level gesture can gate the same way. No demo
  change: this was internal duplication, never adopter boilerplate. (2026-06,
  _Severity 7_)
- **`hooks/useUndoRedoShortcuts`: own "silence while a modal owns the
  keyboard".** Added `gateWhileModalOpen` (default `true`): a chord now no-ops
  while any `[aria-modal="true"]` element is mounted, so a global Cmd/Ctrl+Z
  can't reach through an open dialog to the document behind it — accessibility
  wiring the README used to document as the adopter's job. The demo's `enabled`
  expression now only gates the non-modal navigation drawer; the modal case is
  handled for free. (2026-06, _Severity 4_)
- **`hooks/usePullToRefresh`: own the min-display anti-flicker window.** Added a
  `minDisplayMs` option (default `600`) that holds `"refreshing"` for at least
  that long from gesture-release, even when `onRefresh` settles sooner; a
  refresh that outlasts the floor resets immediately. The demo dropped its
  `setTimeout(r, 900)` pad and the vestigial `syncing` gate. (2026-06, _Severity 7_)

## Investigated and skipped

- **A `useSafeAreaInsets()` / safe-area CSS helper (was an easy win, 3).**
  Re-verified on the 2026-06 sweep: the demo's safe-area usage is pure-CSS
  Tailwind arbitrary values
  (`pt-[calc(1.25rem+env(safe-area-inset-top))]` at
  `demo/src/app/ChecklistScreen.tsx`, footer/bottom at `:236` and
  `SettingsModal.tsx`), **not** JS. A JS `useSafeAreaInsets()` hook can't be
  consumed by that CSS without rewriting it to inline styles (strictly worse),
  so there's no boilerplate to delete in the demo — the lift can't be
  demonstrated. The three sites also use different padding bases
  (`1.25rem` / `0.75rem` / `1.5rem`), which are app layout values; folding them
  into one helper would drag app chrome across the seam. Below threshold as
  framed. Re-evaluate only if an adopter starts reading insets from JS.
