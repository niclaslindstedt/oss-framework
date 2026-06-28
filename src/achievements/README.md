# Achievements

A reusable gamification subsystem: turn each feature of your app into an
unlockable trophy, sorted into four tiers (**Beginner → Intermediate → Pro →
Expert**). The framework owns the **engine** (deriving unlocks from state
transitions, a manual-unlock bus, the React watcher) and the **UI** (a tour
modal, an unlock-celebration modal, a trophy button). Your app owns the
**catalog** (which features are trophies and how each unlocks) and the **store**
(where earned ids live).

```
import {
  useAchievementWatcher,
  unlock,
  AchievementsModal,
  AchievementUnlockModal,
  TrophyButton,
  type Achievement,
} from "@niclaslindstedt/oss-framework/achievements";
```

## What it owns vs. what stays in your app

| Framework owns                                                   | Your app owns                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| The `Achievement` / `Trigger` types, `TIER_POINTS`, `TIER_ORDER` | The **catalog**: the array of `Achievement<TState>` entries |
| `deriveUnlocks` + `useAchievementWatcher` (the unlock machinery) | The **state** (`TState`) predicates read                    |
| The manual-unlock `bus` (`unlock` / `subscribe` / `drain`)       | The **store**: the earned-ids map + the unseen queue        |
| `AchievementsModal`, `AchievementUnlockModal`, `TrophyButton`    | When/where to mount the UI; recording + persistence         |

The seam is deliberate: where a user's earned achievements live (a synced
settings doc, local storage, a server) is an app concern, so the watcher calls
**your** `record` function and reads **your** `unlocked` map. The framework never
persists anything.

## The model

Every achievement is generic over a single app-defined `TState` — the slice(s)
of your state a derived predicate inspects:

```ts
type Achievement<TState> = {
  id: string; // stable, write-once
  tier: "beginner" | "intermediate" | "pro" | "expert";
  glyph: (props: { className?: string }) => ReactNode; // any icon component
  name: ReactNode;
  condition: ReactNode; // one line: what unlocks it
  learnMore?: ReactNode; // optional expanded body
  trigger:
    | {
        kind: "derived";
        predicate: (prev: TState, next: TState) => boolean;
        slices?: (state: TState) => readonly unknown[];
      }
    | { kind: "manual" };
};
```

- **`derived`** — fires when `predicate` flips `false → true` across a state
  transition. Use it whenever the feature mutates the watched state ("created
  the first item", "enabled a setting"). Declare `slices` (the references the
  predicate reads) and the watcher skips the predicate when none changed — cheap,
  as long as your state keeps referential identity on untouched slices.
- **`manual`** — fires when you call `unlock("<id>")` from the chokepoint that
  observes the action (a connect handler, a copy button). The id is queued on an
  in-memory bus until the watcher records it.

Carry the display copy (`name` / `condition` / `learnMore`) **on the entry**. A
non-i18n app hard-codes strings; an i18n app fills them from its translator when
it builds the catalog — so there is no parallel string table to keep in sync.

## Quick start

```tsx
// 1. Define your state slice and catalog (your code).
type AchState = { snapshot: Doc; settings: Settings };

const CATALOG: readonly Achievement<AchState>[] = [
  {
    id: "firstItem",
    tier: "beginner",
    glyph: PlusIcon,
    name: "First Steps",
    condition: "Add your first item.",
    trigger: {
      kind: "derived",
      slices: (s) => [s.snapshot],
      predicate: (p, n) => count(p.snapshot) === 0 && count(n.snapshot) > 0,
    },
  },
  { id: "connected", tier: "pro", glyph: CloudIcon, name: "Connected", condition: "Connect a backend.", trigger: { kind: "manual" } },
];

// 2. Mount the watcher once, high in your tree.
useAchievementWatcher({
  catalog: CATALOG,
  state: { snapshot, settings },
  unlocked: settings.achievements, // your earned-ids map
  loaded, // false until your first backend load resolves
  enabled: !settings.disableAchievements,
  record: store.unlockAchievements, // your writer; returns the genuinely-new ids
  onUnlocked: (ids) => toast(ids), // optional
});

// 3. Fire manual unlocks from wherever the action happens.
await connect();
unlock("connected");

// 4. Render the UI.
<TrophyButton
  unseenCount={settings.unseenAchievements.length}
  onClick={() => (unseen.length ? openUnlock() : openTour())}
/>
<AchievementsModal open={tourOpen} onClose={closeTour}
  achievements={CATALOG} unlocked={settings.achievements} />
<AchievementUnlockModal open={unlockOpen} onClose={ackUnseen}
  achievements={CATALOG} unseenIds={settings.unseenAchievements} />
```

### The `record` / store contract

`record(ids) => string[]` must be **idempotent per id** (recording an
already-earned id is a no-op) and **return only the genuinely-new ids** — those
are what `onUnlocked` celebrates. A typical store also keeps an `unseen` queue
(ids earned but not yet acknowledged): push new ids onto it in `record`, and
clear it when the unlock modal closes. The watcher itself is stateless beyond a
baseline ref.

### The "forward-going only" guarantee

`loaded` exists so loading a saved document never backfills unlocks the user
already had: the watcher treats the first `loaded` render as a baseline and only
derives from deltas after it. Pass `loaded: false` until your backend's first
read resolves, and drop it back to `false` across a backend swap so the next load
re-baselines.

## The contract the UI imposes

The modals and button are styled with the framework theme's CSS-variable-backed
utility classes — `border-line`, `bg-surface`/`bg-surface-2`/`bg-surface-3`,
`text-fg`/`text-fg-bright`/`text-muted`/`text-meta`, `text-flag` (the trophy
accent), `text-pipe`, `text-link`, `text-success`, `text-accent`/`bg-accent`,
`bg-page-bg`. Adopt `@niclaslindstedt/oss-framework/theme` (or define those
variables) and they render correctly; see the theme module's README for the full
token list. The modals reuse the framework `Modal` from `/components`, so they
portal to `document.body` and honour the shared modal stack (Escape/backdrop).

## Adapting to your app

Most apps won't match the defaults exactly. The mismatches and how to reconcile
each:

- **Different copy / another language.** Every visible chrome string is
  injectable via `labels` on each component (defaults exported as
  `DEFAULT_ACHIEVEMENTS_MODAL_LABELS`, etc.); per-achievement copy lives on the
  catalog entry. For i18n, build the catalog from your translator and pass a
  translated `labels`.
- **You want fewer than four tiers.** `TIER_ORDER` drives the tour sections, but
  a tier with no entries renders an empty section — simply ship no achievements
  in tiers you don't use and they fold to a zero-count header, or filter the
  catalog you pass in. (The four tiers and their point values are fixed; if you
  need a different scale, layer your own headers over the catalog data.)
- **Custom tier icons.** Pass `tierGlyphs` to `AchievementsModal` (defaults are
  `DEFAULT_TIER_GLYPHS`).
- **The trophy button lives somewhere specific** (a header vs. a menu row). It
  ships two forms: the compact icon-only button (default), and a full-width menu
  row — pass `showLabel` to render the label text beside the glyph (badge inline)
  so it drops in among sidebar footer rows. Either form's wrapper classes can be
  replaced via `className`. It's presentational and calls `onClick`; the
  quiet-vs-lit decision is yours: you passed `unseenCount`, so branch `onClick`
  on it.
- **Your state isn't a single object.** `TState` can be anything — a tuple, a
  composite `{ a, b }`. Keep referential identity on the slices your predicates
  read (most stores already do) so `slices` can skip cheaply; if you can't, omit
  `slices` and the predicate just runs every transition (correct, slightly less
  efficient).
- **A store that returns all ids, not just new ones.** Wrap it so `record`
  returns only ids that were absent before the write — otherwise `onUnlocked`
  re-celebrates everything on each call.

## Verification

After wiring: perform an action that should unlock a derived achievement and
confirm `onUnlocked` fires exactly once (and not again on reload — the
forward-going guard). Fire a `manual` unlock and confirm it records. Open the
tour and check the counter (`unlocked of total`, points) matches your earned
map, and that the unlock modal lists only unacknowledged ids and clears them on
close.
