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

- **`hooks/usePullToRefresh`: own the min-display anti-flicker window.**
  - **Files:** `src/hooks/usePullToRefresh.ts` (fires `onRefresh` then
    `resetIdle()` the instant the promise settles — `:180`); demo proof at
    `demo/src/app/ChecklistScreen.tsx:83-88` — `doPull` wraps its real work in
    `await new Promise((r) => setTimeout(r, 900))`, with the comment "behind a
    short min-delay so the gesture's spinner reads" (`:80`).
  - **Responsibility handed back:** anti-flicker timing. When `onRefresh`
    resolves fast (a local-first read off IndexedDB/localStorage is near
    instant), the indicator snaps from "refreshing" back to idle before the
    user perceives it, so every adopter pads the handler with a hand-rolled
    `setTimeout` floor. Pure timing choreography, not domain.
  - **Plan:** add `minDisplayMs?: number` to the hook's options (default a tuned
    value, e.g. `600`). The hook holds the `"refreshing"` state at least that
    long from gesture-release before calling `resetIdle()`, even if `onRefresh`
    already settled. Callers passing nothing get the floor for free; the demo
    deletes its `setTimeout(r, 900)` pad. Existing callers see the spinner stay
    up marginally longer — acceptable for an anti-flicker default, but pick the
    default conservatively so it never feels laggy.
  - **Risk:** a default that's too long reads as sluggish; too short doesn't
    fix the flicker. Choose ~600ms and make it overridable. The hook is
    touch-gesture driven, so jsdom tests cover the timing math, not the gesture
    — fake timers + a fast-resolving `onRefresh` asserting the state stays
    `"refreshing"` until the floor elapses.
  - **Severity: 7.**

### Severity 5–6

_(none yet)_

### Severity 3–4

- **`hooks/useUndoRedoShortcuts`: own "silence while an overlay owns the
  keyboard".**
  - **Files:** `src/hooks/useUndoRedoShortcuts.ts:14-18` — the `enabled` doc
    comment literally tells every adopter to pass `false` "while some other
    surface owns the keyboard — e.g. an open drawer or overlay"; demo does
    exactly that at `demo/src/App.tsx:172` (`enabled: pinned || !drawerOpen`).
  - **Responsibility handed back:** the generic half of that gate — don't let a
    global Cmd/Ctrl+Z reach through an open modal to the document behind it — is
    accessibility/interaction wiring the README documents as the adopter's job.
    (The `pinned` term in the demo's expression is app-specific and stays
    app-side.)
  - **Plan:** add `gateWhileModalOpen?: boolean` (default `true`). When on, the
    listener also no-ops while a `[aria-modal="true"]` element is present in the
    DOM. The existing `enabled` prop stays the manual override. An adopter who
    relied solely on `enabled` is unaffected (the new check only *adds* a
    silence condition that their overlays should already want).
  - **Risk:** the default surprises a caller whose overlay is genuinely meant to
    keep undo live, or whose overlay lacks `aria-modal`. Document the contract
    (the framework `Modal` already sets `aria-modal`; verify) and keep
    `gateWhileModalOpen={false}` as the escape hatch. Confirm the framework
    `Modal`/`FloatingPanel` actually carry `aria-modal` before relying on it.
  - **Severity: 4.**

### Easy wins (mechanical, any severity)

- **A `useSafeAreaInsets()` / safe-area CSS helper for adopter screen chrome.**
  - **Files:** repeated generic `env(safe-area-inset-*)` math across demo
    screens — `demo/src/app/ChecklistScreen.tsx:125` (top) and `:237` (bottom),
    `demo/src/app/SettingsModal.tsx:250` (footer). The framework's own
    components already handle their own insets (`pwa/UpdateToast`, the sidebar),
    but the adopter's page containers re-derive the same
    `calc(<pad> + env(safe-area-inset-*))` each time.
  - **Responsibility handed back:** the iOS safe-area calc itself is pure
    platform plumbing, identical everywhere. Note the *screen layout* stays the
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

_(none yet)_

## Investigated and skipped

_(none yet)_
