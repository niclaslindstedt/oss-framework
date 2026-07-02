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

_(none)_

### Severity 5–6

_(none)_

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

- **Safe-area _bottom_ inset under a bottom-anchored FAB, hand-computed in the demo.**
  _(Narrowed 2026-07: the Modal-footer half landed — see Landed. What remains
  is the FAB offset.)_
  Files: `demo/src/app/ChecklistScreen.tsx:252`
  (`bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` on the wrapper that
  positions `FabMenu`); precedent `src/components/FabMenu.tsx:206` (the
  fan-out menu already self-positions at `bottom-[calc(1.25rem+inset)]`, but
  the resting button is positioned by the caller's wrapper).
  **Handed back:** iOS-PWA home-indicator clearance for a bottom-anchored FAB.
  **Plan:** unclear seam — the resting FAB's _position_ (bottom-centered,
  fixed vs absolute) is app layout, not device plumbing, and `FabMenu` today
  deliberately doesn't self-position the resting button. A clean lift would
  need `FabMenu` to offer an opt-in anchored form that owns the bottom offset
  and its inset; verify that doesn't force a positioning policy on apps that
  place the FAB elsewhere.
  **Risk:** changing where `FabMenu` sits is a behaviour change, not an
  additive default; may be over-extraction (app layout). Re-rate on pickup.
  **Severity: 3** (down from 4 — the clean, non-layout half already landed).

### Easy wins (mechanical, any severity)

_(none)_

## Landed

- **2026-07 — Modal footer slot owns the bottom safe-area inset** (was part of
  a severity-4 safe-area row). `Modal` gained an optional `footer` slot; when
  passed, it renders the bar below the scrolling content and follows it with a
  bottom safe-area spacer (`h-[env(safe-area-inset-bottom)] bg-surface-3
sm:hidden`) mirroring the top-inset spacer it already owned. The demo's
  `SettingsModal` footer dropped its hand-computed
  `[padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]` for plain
  `py-3`. Callers passing no `footer` render byte-identically. The FAB half of
  the original row stayed pending (murkier — resting-FAB position is app
  layout).

- **2026-07 — Achievement unlock-ledger mechanics** (was severity 6).
  The idempotent-`record` transition `useAchievementWatcher` requires — per-id
  idempotent unlock, genuinely-new-ids return, deduped unseen-queue push, and
  `clearUnseen` — is now the pure `applyUnlocks(prev, ids, now)` / `clearUnseen`
  pair over an `UnlockLedger` in `src/achievements/ledger.ts`. Both are generic
  over the ledger shape (`T extends UnlockLedger`) so an app's extra fields (the
  demo's first-run `seeded` flag) pass through. The demo's `record`/`clearUnseen`
  collapsed to storing the result + returning the fresh ids; persistence, the
  storage key, and the backfill stay app-side. Unit-testable for the first time.

- **2026-07 — `useLocalStorageState` leaf hook** (was severity 7).
  The safe-parse → merge-partial-over-defaults → write-through persistence
  loop, previously hand-rolled identically in three demo hooks, is now
  `useLocalStorageState<T>(key, defaults, {parse?, serialize?})` in
  `src/hooks/`. The overrides carry the non-JSON slices (the namespaces
  registry's serial format, the raw-string active pointer). The demo's
  `useAppSettings` / `useAchievements` / `useNamespaces` shrank to domain
  logic; the store seam (which key, what shape, whether localStorage at all)
  stays app-side. Deliberately excluded: cross-tab sync and key-change
  re-reads — that's a store, which belongs to the app.

- **2026-07 — Cursor-anchored context menu** (was severity 8).
  `useFloatingPosition` / `FloatingPanel` accept a point anchor
  (`FloatingPoint` / `anchorPoint`), and the new assembled `ContextMenu`
  (actions = the existing `RowAction[]` shape) owns the portal, backdrop,
  Escape, viewport clamp/flip, and keyboard nav; the shared list rendering
  was extracted from `RowActionMenu` into `ActionMenuList` (internal). The
  demo's `RowContextMenu` dropped from ~95 hand-rolled lines to a
  domain-actions-only wrapper.

## Investigated and skipped

- **`FloatingPanel` "surface override" prop** (former easy win, severity 3):
  re-verified 2026-07 and rejected as speculative. The premise was wrong — the
  demo's `ListAppearancePopover` passes `bg-surface-1`, but no `surface-1`
  token exists (`framework.css` defines only `surface` / `surface-2` /
  `surface-3`), so that class is **dead**: the popover already renders the
  panel's baked-in `bg-surface-2`. There is no genuine surface override to
  make ergonomic — a `surface` prop would have no demo consumer, and the rest
  of the passed string (`rounded-md border border-line shadow-lg`) merely
  duplicates classes `FloatingPanel` already bakes. The only real residue is
  the demo's redundant/dead className, a demo-side cleanup, not a framework
  lift. Re-evaluate only if a caller appears that genuinely needs a
  non-default panel surface.
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
