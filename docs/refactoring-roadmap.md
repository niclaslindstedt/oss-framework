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

Known auto-rejections (patterns that have consistently rated 0 on past
sweeps — reject at rating time, don't re-derive):

- **Translated label objects** passed to a component that already ships and
  merges English defaults: that is the i18n layering working, not a too-light
  seam. Only flag a label with no shipped default.
- **Turnkey persisted stores** ("`usePersistedX`" wrappers): they move where
  the user's data lives across the seam. Lift the pure state mechanics; leave
  the persistence wrapper app-side.

## Pending

_Last sweep: 2026-07 — demo-boilerplate audit (the primary angle), full pass
over `demo/src/app/` + the App shell + the non-UI module glue._

### Severity 9–10

_(none)_

### Severity 7–8

- **`localStorage` load/merge/persist loop duplicated in three demo hooks.**
  Files: `demo/src/app/useAppSettings.ts` (load + merge-defaults + write-back),
  `demo/src/app/useAchievements.ts:24-54` (same),
  `demo/src/app/useNamespaces.ts` (loadList/loadActive + per-mutation sync);
  home would be `src/hooks/`.
  **Handed back:** the safe-parse → merge-with-defaults → write-on-change
  persistence mechanic. Three demo hooks implement it identically (try/catch
  around `JSON.parse`, spread defaults under the parsed partial, `useEffect`
  write-through); every adopter of settings/achievements/namespaces writes the
  same loop. The mechanic is generic — the app still owns the key, the shape,
  and _that_ it persists (the store seam stays app-side).
  **Plan:** a new leaf hook `useLocalStorageState<T>(key, defaults)` in
  `src/hooks/` (cross-module duplication N≥3 with no existing home — the one
  case that earns a new primitive). Demo hooks shrink to domain logic over it.
  **Risk:** scope creep (cross-tab sync, storage events) — keep v1 to the
  demonstrated loop; do NOT absorb the domain wrappers themselves (see
  Investigated-and-skipped). **Severity: 7.**

### Severity 5–6

- **Achievement unlock-ledger mechanics (idempotent `record` + unseen queue).**
  Files: `demo/src/app/useAchievements.ts:81-101`, home `src/achievements/`.
  **Handed back:** the exact state transition `useAchievementWatcher`'s
  contract requires — idempotent per-id recording, returning only
  genuinely-new ids, deduped unseen-queue push, `clearUnseen`. Subtle (the
  fresh-ids return drives the celebration modal; a naive rewrite double-fires)
  and fully generic; every adopter re-derives it. Persistence and the demo's
  first-run backfill stay app-side.
  **Plan:** export a pure `applyUnlocks(prev, ids, now)` helper (or an
  in-memory `useUnlockLedger` with the `record`/`clearUnseen` surface) from
  `src/achievements`; the demo keeps its localStorage wrapper (composes with
  the `useLocalStorageState` row above). Watcher contract unchanged.
  **Risk:** low — pure logic, unit-testable for the first time. **Severity: 6.**

### Severity 3–4

- **Menu-item button duplicated between the action menus and `SelectPicker`.**
  _(Narrowed 2026-07: the context-menu lift removed the demo's hand-rolled
  `MenuItem` and gave `RowActionMenu` + `ContextMenu` one shared list,
  `src/components/ActionMenuList.tsx` — what remains is the framework-internal
  overlap with the picker.)_
  Files: `src/components/ActionMenuList.tsx` (item button),
  `src/components/SelectPicker.tsx:296-306`.
  **Duplicated:** the same `role="menuitem"`-style button — flex layout,
  `px-3 py-2` padding, tone + highlight states — in two framework components
  with drifting class strings.
  **Plan:** extract a `MenuItem` in `src/components/`, consume it from
  `ActionMenuList` and `SelectPicker` with pixel-identical output, and decide
  whether to export it for apps.
  **Risk:** the two sites' classes differ slightly (`bg-surface-3` highlight
  vs hover-only); the extraction must reproduce each exactly or it's a visual
  change. **Severity: 4** (down from 5 — the adopter-facing duplication is
  gone; this is now internal hygiene).

- **Safe-area _bottom_ inset hand-computed in the demo; framework owns only the top.**
  Files: `demo/src/app/SettingsModal.tsx:252`
  (`[padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]` on the modal
  footer), `demo/src/app/ChecklistScreen.tsx:252`
  (`bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` under the FAB);
  precedent `src/components/Modal.tsx:210-219` (Modal already owns
  `safe-area-inset-top`).
  **Handed back:** iOS-PWA home-indicator clearance — generic device plumbing
  the framework already half-owns (top edge yes, bottom edge no).
  **Plan:** give `Modal` an optional `footer` slot that owns the bottom inset
  (mirroring its top-inset spacer), and/or default the FAB/`FabMenu` bottom
  offset to include the inset. Default must reproduce today's rendering for
  callers passing nothing.
  **Risk:** a footer slot is new API surface — design it against the demo's
  three-button footer to be sure it fits. **Severity: 4.**

### Easy wins (mechanical, any severity)

- **`FloatingPanel` callers re-supply the shell classes to change one thing.**
  Files: `demo/src/app/ListAppearancePopover.tsx:67` (passes
  `rounded-md border border-line bg-surface-1 p-3 shadow-lg` — three of those
  five classes are already rendered by `src/components/FloatingPanel.tsx:88`,
  and the appended `bg-surface-1` only beats the baked-in `bg-surface-2` by
  CSS-order luck); `src/components/RowActionMenu.tsx:147` and
  `demo/src/app/SideMenuContent.tsx` (menus all append `py-1`).
  **Plan:** an optional `surface` (and/or `padding`) prop whose default emits
  today's exact class string, so overriding the background stops requiring the
  caller to re-state the shell and stops depending on class order.
  **Risk:** keep the default output byte-identical; Tailwind class-conflict
  semantics are the whole bug here. **Severity: 3.**

## Landed

- **2026-07 — Cursor-anchored context menu** (was severity 8).
  `useFloatingPosition` / `FloatingPanel` accept a point anchor
  (`FloatingPoint` / `anchorPoint`), and the new assembled `ContextMenu`
  (actions = the existing `RowAction[]` shape) owns the portal, backdrop,
  Escape, viewport clamp/flip, and keyboard nav; the shared list rendering
  was extracted from `RowActionMenu` into `ActionMenuList` (internal). The
  demo's `RowContextMenu` dropped from ~95 hand-rolled lines to a
  domain-actions-only wrapper.

## Investigated and skipped

- **`SyncStatus` label wiring in both screens** (`ChecklistScreen.tsx:194-204`,
  `NoteScreen.tsx:47-62`): looked like duplicated boilerplate, but the
  component already ships and merges `DEFAULT_SYNC_STATUS_LABELS`
  (`src/sync/SyncStatus.tsx:113`); the demo passes _translations_, which is the
  i18n layering working as designed. A `labelKeyPrefix` bridge would teach the
  framework the app's i18n keys — domain. The two-screen duplication is demo
  factoring (hoist one shared labels object app-side). Re-evaluate only if a
  label appears that has no shipped default.
- **Turnkey persisted stores** (`usePersistedNamespaces`,
  `usePersistedAchievements`, `usePersistedAppearance` — proposed against
  `useNamespaces.ts` / `useAchievements.ts` / the appearance state): hard
  rejection — each would move _where the user's data lives_ (persistence keys,
  the store) across the seam. The generic mechanics they contain are covered by
  the `useLocalStorageState` and unlock-ledger Pending rows; the wrappers stay
  app-side.
- **`localStorage` key-namespacing helper** (the `oss-demo:checklist:*` prefix
  across 7 call sites): a one-line template literal; the keys themselves are
  app-owned. Cosmetic (below threshold).
- **Default `storageKey`/`eventName` in `createI18n`**: defaults invite
  same-origin collisions between two apps; the explicit key _is_ the seam
  working. Rejected.
- **PWA cache-id derivation** (`demo/src/app/pwa.ts:17-20`): driven by the
  demo's three-slot GitHub Pages deployment, not something every adopter
  writes. Rejected as demo-infra.
- **Search corpus walk/grouping** (`demo/src/app/search.ts:59-125`): the
  compile→walk→group→score loop is shaped entirely by the app's tree domain;
  `src/search/README.md` documents the seam deliberately. Rejected.
- **Deliberate demo-only mocks** (per `demo/ADOPTION.md`): the simulated sync
  engine (`useMockSync.ts`), log seeding (`log.ts`), the storage playground,
  the PWA update simulation, and the achievements first-run backfill are all
  REPLACE/DELETE items for adopters — not seams.
- **Misc app-side-by-design**: `SettingsModal` conditional tab filtering
  (feature flags are domain); `SearchOverlay` depth-indent formula (inside
  `SearchModal`'s render-prop boundary); `RowContextMenu`'s English strings
  (app copy); gating `RowActionMenu` with `useDesktopPointer` (gesture policy
  belongs to the app).
