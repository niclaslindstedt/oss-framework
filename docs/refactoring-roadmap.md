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

- **Collapse the duplicated `[aria-modal="true"]` modal-gate probe into one
  shared helper.**
  - **Files:** the identical `document.querySelector('[aria-modal="true"]') !==
null` check is now hand-rolled in three places —
    `src/hooks/usePullToRefresh.ts:87`, `src/sidebar/useEdgeSwipeOpen.ts:42`,
    and `src/hooks/useUndoRedoShortcuts.ts` (`hasOpenModal`). Each suppresses a
    global gesture/shortcut while a framework dialog owns the screen.
  - **Responsibility handed back:** none to the _adopter_ — this is internal
    duplication. "Is a modal open?" is one generic DOM probe re-implemented N=3
    times; a contract change (e.g. honouring `inert`, or a second marker
    attribute) would have to be made in three spots and could silently drift.
  - **Plan:** add a leaf helper in `hooks` (e.g. `isModalOpen()` /
    `useModalOpen`) and have all three call it. `hooks` is a leaf so both
    `sidebar` and the sibling hooks may import it without breaking the one-way
    dependency rule (feature → hooks is allowed). Pure internal refactor, no
    public-surface change beyond optionally exporting the helper.
  - **Risk:** low — behaviour-identical extraction. Decide whether the helper
    is public surface (exported, documented) or internal-only; if exported it
    needs a changeset, if internal it's a pure refactor.
  - **Severity: 7.**

### Severity 5–6

_(none yet)_

### Severity 3–4

_(none yet)_

### Easy wins (mechanical, any severity)

- **A `useSafeAreaInsets()` / safe-area CSS helper for adopter screen chrome.**
  - **Files:** repeated generic `env(safe-area-inset-*)` math across demo
    screens — `demo/src/app/ChecklistScreen.tsx:125` (top) and `:237` (bottom),
    `demo/src/app/SettingsModal.tsx:250` (footer). The framework's own
    components already handle their own insets (`pwa/UpdateToast`, the sidebar),
    but the adopter's page containers re-derive the same
    `calc(<pad> + env(safe-area-inset-*))` each time.
  - **Responsibility handed back:** the iOS safe-area calc itself is pure
    platform plumbing, identical everywhere. Note the _screen layout_ stays the
    adopter's — what's liftable is only the inset arithmetic, not the chrome.
  - **Plan:** ship a tiny `useSafeAreaInsets()` returning `{top,right,bottom,
left}` px (read from CSS env vars), or a documented utility, in `hooks`.
    Additive; nothing changes for existing callers. Keep it a convenience, not a
    layout component (that would drag app chrome across the seam).
  - **Risk:** marginal value — it shaves a `calc()`, not real boilerplate; rate
    honestly. Reading `env()` from JS needs a probe element; CSS-only adopters
    gain nothing. Borderline; left as an easy win, not a priority.
  - **Severity: 3.**

## Landed

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

_(none yet)_
