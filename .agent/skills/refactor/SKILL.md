---
name: refactor
description: "Use to work the framework's component-improvement backlog in docs/refactoring-roadmap.md, to extend it with newly-discovered opportunities, or to clear it back to a blank slate. Its lens is components extracted too lightly: already-extracted modules that handed too much generic (non-domain) responsibility back to the adopter — UI plumbing, default values, accessibility wiring, gesture-to-markup, anti-flicker timing, positioning — that the component should own instead, so every green-field app writes less boilerplate. Picks the highest-leverage pending item, re-verifies it against the current tree (the demo and the module APIs drift), and either lands the lift, skips it with a written reason, or extends the roadmap when an Explore sweep finds something new. Guardrail: lift non-domain responsibility IN; never drag the store, domain types, or business rules across the seam. Grounded in the roadmap — bootstraps it on first run, stops when the queue is empty."
---

# Working the component-improvement roadmap

`docs/refactoring-roadmap.md` is the single source of truth for the
opportunities this framework has catalogued to make its **already-extracted
components carry more of their own weight**. It carries:

- a strategic-context section explaining the lens (below);
- a **severity rubric** (1–10, with **3** as the fix threshold and an
  "easy wins" carve-out for mechanical, zero-risk lifts);
- a **Pending** list grouped by severity band, with file paths and plans;
- a **Landed** list of past lifts;
- an **Investigated and skipped** list of candidates rejected on prior
  sweeps, with the reasoning.

This skill is the operating procedure for that file. There are three modes:

- **Work mode** — pick the highest-leverage pending item, verify, land it
  (or skip it with a reason).
- **Explore mode** — survey the framework + demo for components extracted
  too lightly, rate them, and append them to **Pending**.
- **Clear mode** — wipe the roadmap's findings back to its bootstrap shape,
  then optionally chain into a fresh Explore to repopulate it.

The skill is **grounded**: every action references a specific row in the
roadmap. Don't widen a component that isn't on the list — file a finding
under Explore mode first, get it rated, then land it on a follow-up pass.
**Don't keep going once Pending is empty.** A clean roadmap means the
extracted surface is pulling its weight and the next adopter writes the
least boilerplate it can.

## The lens: components extracted too lightly

The framework was filled incrementally by the `find-refactor-candidates`
skill, one extraction at a time. Each extraction drew a **seam** between what
the component owns and what stays in the app, and the standing guidance there
is conservative on purpose — _"drop the glue at the seam,"_ _"leave the store
in the app,"_ _"extract the data + the pure logic."_ That conservatism is
right for **domain** coupling. But some seams were drawn **too far toward the
app**: they handed back generic, non-domain responsibility that **every**
green-field adopter then has to re-implement the same way. That is a
component extracted too lightly, and it is exactly what this skill hunts.

The whole judgment is one question, asked of every seam:

> **Would every app that adopts this component write this same code, and is
> that code _not_ domain/business logic?** If yes, the component should own
> it (as default behaviour, overridable) — not hand it back.

### Lift IN — the component should own this

Generic responsibility an adopter shouldn't have to supply:

- **UI plumbing the caller is forced to assemble** — a hook that hands back
  raw `state` + `handlers` but makes every caller build the same generic
  chrome around them (a gesture hook returning offsets but no rendered strip;
  a positioning hook returning coords but no panel). Offer the assembled form
  too, with the generic markup inside.
- **Defaults for props every adopter sets the same way** — a required prop
  that is always the same generic value (an English label, a `48`px edge
  zone, a `min-delay` anti-flicker window, a z-index, a duration). Give it a
  sensible default; keep it overridable.
- **Accessibility / interaction wiring** — focus management, `aria-*`,
  Escape-to-close, keyboard chords, `prefers-reduced-motion`, pointer-vs-touch
  detection. This is plumbing, not product; the component should own it.
- **Timing / anti-flicker / animation orchestration** — `BUSY_MIN_MS` floors,
  debounced saves, slide-in transitions. Generic and fiddly — own it.
- **Boilerplate the README documents as the adopter's job** — if a module's
  "adapting to your app" section tells every adopter to write the same wiring,
  that wiring is a candidate to absorb into the default path.
- **The same plumbing duplicated across demo screens or sibling components** —
  lift it into one shared primitive the components consume.

### Keep OUT — this stays app-side (the seam working correctly)

Lifting responsibility in is **not** a licence to pull domain logic across.
Reject (or rate down) any candidate whose absorption would require:

- **the store / where the user's data lives** — `useSyncExternalStore`
  wrappers, persistence keys, synced settings docs, undo history. The app
  owns where the user's choice lives.
- **domain types / entities** — `Note`, a checklist item's `templateId` /
  `folderId` / `archived`, namespace shapes. The component takes a generic
  shape; the app intersects its fields back on.
- **business rules** — app-specific validation, workflow, what a feature
  _means_. Generic mechanics yes; product decisions no.
- **side-effecting asset imports** — `@fontsource/*` CSS, `import.meta.glob`
  results. Stay the consuming app's dependency (optional peer deps).
- **app-specific copy beyond an English default** — ship English defaults;
  take the rest as injectable `labels`.

A candidate that can only be absorbed by dragging one of these across the
seam is **over-extraction**, the opposite failure — it ossifies app domain
into the framework. That is a _rejection_, recorded in Investigated-and-
skipped, not a lift.

## Bootstrap — first run, before anything else

`docs/refactoring-roadmap.md` does not exist yet. The **first** time this
skill runs, create it before any other work:

1. Create `docs/` if absent and write `docs/refactoring-roadmap.md` with:
   - a short **strategic-context** intro (the lens above — too-light seams,
     the lift-IN / keep-OUT lists, the one-question test);
   - the **severity rubric** table (reproduced under "Rate each finding");
   - an empty **Pending** section (severity-band sub-headings + an "Easy
     wins" carve-out at the bottom);
   - an empty **Landed** section;
   - an empty **Investigated and skipped** section.
2. Then proceed in **Explore mode** to populate **Pending** — pick one survey
   angle, run it, and write the findings into the file you just created.

After the bootstrap run the file exists and behaves as the source of truth;
this step is a no-op once present.

## Modes — pick one per invocation

Pick at session start; don't blend modes within one PR. Each PR carries a
single item from one mode (Clear mode may chain a fresh Explore into the same
PR — see its loop).

- **Work mode** (default): user asked you to "work the refactor backlog",
  "land the next component improvement", "deepen another seam". Run the
  **Work-mode loop**.
- **Explore mode**: user asked you to "find more lift candidates", "do
  another sweep", "extend the roadmap". Run the **Explore-mode loop**.
  (Bootstrap, above, ends here.)
- **Clear mode**: user asked you to "clear the roadmap", "wipe the backlog",
  "reset the roadmap". Run the **Clear-mode loop**.

If the user is ambiguous ("can you tidy up the components?"), ask which mode
before doing anything. The cost of guessing wrong is a PR pointed at the
wrong outcome.

## Work-mode loop

### 1. Open the roadmap and pick a candidate

Look at **Pending**. Pick the **highest-severity** item the current session
can plausibly land in one PR. Tie-break:

1. **Highest-leverage lifts first** (severity 9–10). A responsibility
   _every_ adopter re-implements, or a component handed back so thin it's
   barely worth importing — these waste the most adopter effort.
2. **Easy wins** at any severity (a default value for an always-same prop, an
   injectable label, a one-line guard). The roadmap has an explicit "Easy
   wins" list at the bottom of Pending.
3. **Severity 7–8 multipliers** next (plumbing duplicated across the demo /
   sibling components).
4. **Severity 5–6 friction** if the harder bands are blocked or in flight.
5. **Severity 3–4** opportunistically — usually a drive-by while touching the
   module for other reasons.

If you can't pick one — e.g. every remaining 9-band item needs a cloud OAuth
flow (Dropbox / Google Drive) you can't reach in this environment to verify —
tell the user, surface the constraint, and ask whether to drop a band or do
an Explore sweep instead.

### 2. Re-verify before touching code

The roadmap goes stale between sweeps. Confirm the candidate is still real:

```sh
# The demo is the prime evidence: read what generic plumbing it still does
# around the component. If a prior PR already lifted it, the candidate is
# done — move it to Landed and stop.
grep -rn '<the-boilerplate-shape>' demo/src

# Confirm the component's current public surface — a prop may already have
# gained the default the candidate proposes.
sed -n '1,80p' src/<module>/<Component>.tsx
```

If the responsibility has already been partly absorbed, **re-rate** before
acting. A candidate that drifted from 7/10 to 3/10 may still be worth landing
but the plan needs updating. If the demo no longer does the boilerplate at
all, move the row to **Investigated and skipped** with "already absorbed —
re-evaluate if it reappears" and stop.

### 3. Land the lift

Follow the per-candidate **Plan** in the roadmap as a starting point, but the
plan is allowed to be wrong — if you find a cleaner seam while reading the
code, use it and amend the roadmap entry in the same PR.

Lift rules:

- **Additive and backward-compatible.** Lifting responsibility in changes the
  component's _public surface_, but it must **not** change rendered output or
  behaviour for code that already wired the component. Make the absorbed
  responsibility the component's **default**, overridable by an optional prop
  whose default reproduces today's behaviour. An adopter who passes nothing
  new sees no change; an adopter who used to write the boilerplate can now
  delete it.
- **This IS published surface — it needs a changeset.** Unlike a pure
  refactor, a lift adds or changes a prop / default / capability on the
  module's public API, so per [`.changes/README.md`](../../../.changes/README.md)
  it drops a fragment under `.changes/unreleased/` — usually `type: Changed`
  ("`Foo` now handles X for you") or `type: Added` (a new rendered form /
  capability). Never `no-changelog` a lift that touches the exported surface.
- **Never drag domain across the seam.** Re-read "Keep OUT" above before you
  start. If landing the lift turns out to require importing a domain type, the
  store, or a business rule, **stop** — it's over-extraction, not a lift.
  Move the row to Investigated-and-skipped with that reasoning.
- **Respect the one-way dependency rule.** Code flows one way: leaf modules
  (`hooks`) must not import from feature modules (`storage`, `theme`,
  `sidebar`, …). A lift must not move code in a way that makes a leaf hook
  import _up_. (`components → hooks` is fine — that direction is already
  established; only the leaf `hooks` must stay leaf.) If a candidate seems to
  need the wrong direction, the responsibility belongs in the feature module,
  not the leaf — re-home it there (the `useEdgeSwipeOpen` precedent: it lives
  in `sidebar`, not `hooks`, because it needs a sidebar type).
- **Keep `react` / `react-dom` peer-only.** Never add a second copy, never
  bundle them. Side-effecting asset imports stay external (see the gotcha in
  `find-refactor-candidates`).
- **Hold the line on size.** Each PR should aim for <500 lines of diff and
  keep every touched source file under the **1000-line cap** (OSS_SPEC §20.5).
  If a lift would push a file over, split by concern in the same PR.
- **Run the gates.** `make lint && make test && make build && make fmt-check`
  before opening the PR (`make lint` is `eslint . && tsc --noEmit` — the
  typecheck is folded in; tests are Vitest only). Confirm the build kept asset
  imports **external** in `dist/` if the module pulls any.
- **Leave coverage better than you found it.** A lift exposes the absorbed
  responsibility to direct unit testing for the first time — it used to live
  in the app, untestable from here. Add the tests the new seam makes possible
  in the **same** PR (`tests/<subject>.test.ts`, jsdom for UI). Run a coverage
  pass (`npx vitest run --coverage`, installing `@vitest/coverage-v8` if
  absent) over the touched files and confirm the numbers went up. A lift that
  moves logic in without testing it has only half-delivered.
- **Smoke-test storage-layer lifts by hand.** The `storage` backends'
  OAuth / cloud flows (Dropbox, Google Drive) have **no automated coverage**,
  so any lift touching them must be exercised against the demo's local backend
  plus whichever cloud flow the change reaches before merging.

### 4. Update the demo in the same PR (required)

A lift is not done until the demo **consumes the now-richer component and
deletes the boilerplate it used to do.** The demo (`demo/`) is the
framework's reference app and the living proof the seam improved — if the
demo still hand-rolls the responsibility you just lifted, you haven't
demonstrated the win.

1. Simplify the demo's wiring to use the new default / absorbed form. The
   diff should _remove_ adopter boilerplate, not add it.
2. Keep the seam honest — the demo still owns the store/state and passes data
   - English labels in. Never reach past a module's public subpath export; if
     the demo needs something the export doesn't offer, that's a signal the lift
     is incomplete, not a reason to deep-import.
3. Build the demo (`npm run build --workspace demo`) green and **verify the
   surface still renders and responds** in the running app (a headless
   Chromium screenshot of the affected screen). Match the existing black/green
   look and quality.

### 5. Update the roadmap in the same commit

Edit `docs/refactoring-roadmap.md` to reflect the new state:

- **Move the row from Pending to Landed.** One-line summary + the date
  (`YYYY-MM`). If it shipped as a multi-PR plan and only step 1 landed, leave
  it in Pending with the scope narrowed.
- **If the responsibility was smaller than the roadmap claimed**, drop the
  severity in the moved row and note "narrower than expected".
- **If you found a related too-light seam while reading the code**, add a
  Pending row in the right band. Don't fix it in the same PR.

The roadmap edit is **part of the lift PR**, not a follow-up — a PR that lands
the code without updating the roadmap will silently re-propose the same work.

### 6. Update the docs sync points

Per `AGENTS.md`'s documentation sync points, a lift that changes a module's
public surface also updates:

- the module's `src/<module>/README.md` — fold the absorbed responsibility
  into the usage / API section, and trim any "adapting to your app" boilerplate
  the component now owns (READMEs are **app-agnostic** — never name a source
  app);
- the top-level `README.md` API section if the root surface changed;
- the `.changes/unreleased/` fragment (step 3).

### 7. Stop when Pending is empty

If Pending has no rows left, the sweep is **done**. Don't invent items to keep
going. Tell the user the backlog is empty and recommend either feature work,
running `find-refactor-candidates` to extract something new, or running this
skill in **Explore mode** to look for too-light seams that emerged since the
last sweep.

## Explore-mode loop

This mode extends the roadmap. The cost of a bad lift is high; the cost of a
bad roadmap entry is low (it sits in Pending until re-rated). So Explore mode
is more permissive about flagging — but every entry gets a rating, a file
path, and a sentence naming **the generic responsibility being handed back and
why every adopter would re-implement it**. No ratings-by-vibe.

### 1. Read the roadmap first

Skim the existing Pending / Landed / Investigated lists so you don't
re-propose what's there. **Investigated-and-skipped is especially important** —
it records the seams that looked too light but turned out to need domain logic
to absorb (over-extraction rejections). Don't re-propose one unless you can
explain what changed.

### 2. Pick a survey angle

You can't audit everything in one session. Pick a frame and stick to it:

- **Demo-boilerplate audit (the primary angle).** Read `demo/src/app/` and,
  for each framework component the demo uses, list the generic (non-domain)
  plumbing the demo does _around_ it — markup assembly, default values it
  re-supplies, timing/animation it orchestrates, accessibility it wires. Each
  pattern that **every** adopter would repeat, and that isn't domain logic, is
  a candidate. This is where too-light seams show up most concretely.
- **Handback audit.** Grep the hooks and presentational components for ones
  that return raw `state` + `handlers` and assemble nothing:
  `grep -rn 'return {.*handlers' src` and read each. If the caller is forced
  to build _generic_ chrome around the handback, propose an optional assembled
  form with the chrome inside (the `useRowSwipe` → `Checklist` precedent: the
  hook owns the gesture, the component grew to own the strip/foreground).
- **Default-value audit.** For each module README's quick-start, note every
  prop the example sets to a generic constant (`48`, an English string, a
  z-index, a `min-delay`). A prop every adopter sets the same way wants a
  default. `grep -rn 'required' src/*/README.md` and read the API tables.
- **README "adapting to your app" audit.** Read each `src/<module>/README.md`
  "adapting" section. Where it instructs every adopter to write the same
  wiring (not app-specific reconciliation), that wiring is a candidate to make
  the default path.
- **Cross-module duplication.** Grep for the same plumbing reimplemented in
  multiple demo screens or sibling components (positioning math, escape
  handling, anti-flicker floors). Report N≥2 sites with line numbers; the fix
  is one shared primitive the components consume.
- **Thin-export audit.** A module whose public surface is one type + one
  pure function, where the demo then writes 50 lines of generic glue to make
  it usable, was extracted too lightly. List the export, then the glue.

Delegate broad sweeps to `Agent(subagent_type: "Explore")` with a
self-contained brief — surveys produce a lot of file reads the parent context
shouldn't carry.

### 3. Rate each finding 1–10

Use the rubric in the roadmap:

| Band | What to look for                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9–10 | Every adopter must re-implement a non-trivial, non-domain responsibility the component should own — or a handback so thin the component is barely worth importing. The README even documents the boilerplate as the adopter's job. |
| 7–8  | Generic plumbing duplicated across the demo or sibling components; lifting it removes real boilerplate for every adopter.                                                                                                          |
| 5–6  | A required prop that's always the same generic value; a sensible default would simplify adoption.                                                                                                                                  |
| 3–4  | Minor convenience: an optional rendered form, a default label, a `prefers-reduced-motion` guard. Cheap, opportunistic.                                                                                                             |
| 1–2  | Cosmetic. Don't add to the roadmap; it'll re-surface if it ever matters.                                                                                                                                                           |

**Hard rejection (rate 0 / skip):** if the responsibility can only be absorbed
by importing the store, a domain type, a business rule, or a side-effecting
asset, it is **not** a lift — it's over-extraction. Record it in
Investigated-and-skipped with that reasoning so the next sweep doesn't re-raise
it.

For each finding ≥3, write a Pending row with:

- **The file path(s)** (component + the demo/README site that proves the
  boilerplate).
- **The responsibility being handed back** — one or two sentences, concrete
  enough to re-verify with a grep, naming why it's generic (not domain).
- **The plan** — the new default / optional prop / assembled form, and that
  existing callers stay behaviour-unchanged.
- **The risk** — what could go wrong (a default that surprises an existing
  caller; a storage flow with no automated coverage; whether it's multi-PR).
- **The rating**, bold, at the end: `**Severity: N.**`

Place the row in the right band; an "Easy wins" carve-out at the bottom holds
the mechanical default-value lifts.

### 4. Skip findings that fail the rubric

Below 3, or a hard rejection, **don't** add it to Pending — note it in the PR
body (cosmetic) or in Investigated-and-skipped (over-extraction), and move on.
A roadmap of 10 honest lifts is more useful than 40 aspirational ones.

### 5. Don't lift in Explore mode

Explore mode opens a PR that **only** edits `docs/refactoring-roadmap.md`. The
code stays the same. Work mode handles the lift on a subsequent pass — the
two-PR rhythm forces the discovery to be sanity-checked before someone acts on
it.

### 6. Stop after one survey angle

Explore mode is a **bounded sweep**. Pick one angle, exhaust it, write the
findings, open the PR. If the chosen angle yielded 10+ findings, ship it and
let a future session pick the next angle. If it yielded zero (the seam is
already deep), say so in the PR body and pick a different angle next time.

## Clear-mode loop

Clear mode resets the roadmap's **findings** back to the empty, freshly-
bootstrapped shape so a fresh sweep can start clean. The user reaches for it
when the backlog has gone stale wholesale.

### 1. Confirm before wiping — clearing is destructive

Clearing discards the **Pending** queue, the **Landed** history, and — most
consequentially — the **Investigated-and-skipped** reasoning, which is what
stops future sweeps from re-proposing seams already examined and rejected as
over-extraction. Git history preserves the old file, but the _working_ roadmap
loses it. Before wiping, **state what's about to go** (the row counts in each
of the three lists) and confirm with the user unless they were explicit. Use
`AskUserQuestion` if there's any doubt.

If only part of the roadmap is stale, that is **not** a full clear — offer to
clear only Pending, or to handle stale rows individually via Work / Explore
mode.

### 2. Reset the file to its bootstrap shape

Rewrite `docs/refactoring-roadmap.md` to the post-bootstrap state:

- **Keep the scaffolding** — the strategic-context intro (the lens) and the
  severity rubric. These are the framework, not findings.
- **Empty the three finding lists** — leave Pending (with its band
  sub-headings + the "Easy wins" carve-out), Landed, and Investigated-and-
  skipped present but empty. An empty Pending is a valid terminal state.

### 3. Offer a fresh Explore

Ask whether to chain a fresh Explore. If yes, switch to the Explore-mode loop,
pick one survey angle, and write its findings into the now-empty Pending — the
one case where two modes share a PR. If no, stop and tell the user the roadmap
is blank.

### 4. One PR, roadmap-only

The clear (and any chained Explore) edits **only**
`docs/refactoring-roadmap.md` — no code changes. A roadmap reset is not
user-visible, so it lands `no-changelog`.

## What this skill explicitly does NOT do

- **Doesn't lift code that isn't on the roadmap.** See a too-light seam during
  Work mode? File it under Explore-mode behaviour (add a rated Pending row),
  then return to the original candidate. No drive-by widening.
- **Doesn't drag domain logic into the framework.** The whole point is lifting
  _non-domain_ responsibility. The store, domain types, business rules, and
  side-effecting asset imports stay app-side — absorbing them is over-
  extraction, the failure this skill is the mirror of. When in doubt, leave it
  out and record why.
- **Doesn't change behaviour for existing callers.** A lift is additive: the
  absorbed responsibility becomes an overridable default that reproduces
  today's output. A lift that changes what the component renders for a caller
  who passes nothing new is a feature change in a trench coat — split it.
- **Doesn't introduce abstractions speculatively.** "An adopter might want
  this" is not evidence. The roadmap captures responsibility the demo (or a
  README) **demonstrably** re-implements; if no one writes the boilerplate
  yet, wait.
- **Doesn't keep going past an empty Pending list.** When the backlog is
  clean, the next action is feature work or a fresh extraction via
  `find-refactor-candidates`. Stop.
- **Doesn't bundle items.** One roadmap row per PR (Clear mode's chained
  re-explore is the lone exception).
- **Doesn't clear the roadmap silently.** Clear mode confirms what's about to
  be lost before rewriting the file.

## Relationship to `find-refactor-candidates`

The two skills are complementary halves of the same goal:

- **`find-refactor-candidates`** pulls **new** code _out_ of the source apps
  (`notes` / `checklist`) into a fresh framework module, drawing the seam for
  the first time.
- **`refactor`** (this skill) deepens an **existing** seam — taking a module
  that was extracted too lightly and lifting more generic responsibility _in_
  from the adopter side, using the demo as the evidence of what every app
  re-implements.

When `find-refactor-candidates` draws a seam too conservatively, the result is
a too-light component — and that becomes a Pending row here. Conversely, if
this skill finds itself wanting to absorb domain logic, the right answer is
usually that the _module_ is mis-scoped, which is a `find-refactor-candidates`
conversation, not a lift.

## Common pitfalls

- **Absorbing domain logic to "simplify" the demo.** The demo writing less
  code is only a win if what you lifted was generic. Pulling a domain type or
  the store across the seam to shrink the demo diff is over-extraction —
  exactly the failure this skill exists to avoid.
- **Changing rendered output while "just moving code in".** A lift must be
  invisible to a caller who passes nothing new. If the default you chose
  differs from what the demo did before, you changed behaviour — make the
  default reproduce the old output, or it's a feature PR.
- **Forgetting the changeset.** Unlike a pure refactor, a lift touches the
  published surface — it needs a `.changes/unreleased/` fragment. `no-changelog`
  is wrong here.
- **Leaving the demo hand-rolling the lifted responsibility.** If the demo
  still does the boilerplate after the lift, the win is unproven. Simplify the
  demo's wiring and verify it in the running app.
- **Lifting into a leaf hook something that needs a feature-module type.** That
  breaks the one-way dependency rule. The responsibility belongs in the
  feature module instead (the `useEdgeSwipeOpen` → `sidebar` precedent).
- **Inflating severity to justify the work.** If every adopter wouldn't
  actually re-write it, it's not a 9. The ratings are how the next agent
  spends their time; inflating them devalues the signal.
- **Moving logic in without testing it.** The lift makes the responsibility
  unit-testable for the first time. Add the tests in the same PR — deferring
  them means the next sweep sees green CI over untested code and assumes it's
  covered.

## Skill self-improvement

After a run, leave the skill sharper than you found it:

1. If a new survey angle found a too-light seam the listed angles missed (e.g.
   "audit each module's storybook-less demo screen for re-supplied defaults"),
   add it to "Pick a survey angle".
2. If a class of finding consistently rates the same (e.g. every "default for
   an always-same label" lands as an easy win at 4), capture the pattern in the
   roadmap's rubric so the next agent doesn't re-derive it.
3. If a lift exposed an unexpected risk (a default that surprised an existing
   caller; an asset import that stopped externalising; a leaf-hook dependency
   inversion), document it in the roadmap's plan column and, if general, in the
   "Common pitfalls" above.
4. If a candidate turned out to be over-extraction only once you started
   landing it, record the tell in "Keep OUT" so the next sweep rejects it at
   rating time, not at land time.

Commit the SKILL.md edit alongside the substantive PR — drift on the skill
itself is the same kind of decay this skill prevents.
