---
name: expand-framework
description: "Use when asked to 'expand the framework', 'add the next module', or grow the library's capability surface. Works the expansion roadmap in docs/expansion-roadmap.md — the queue of net-new capability modules (toasts, tabs, format, calendar, viewer, draw, virtual list, expression, …) that widen the set of app kinds the framework can carry. Picks the next pending module by the roadmap's phasing, re-verifies its design against the current tree, implements it end to end under the standing rules (zero runtime deps, no domain naming, pure core + thin components, theme tokens, injected labels, full wiring checklist, tests, demo showcase, README row, changeset fragment), and flips its roadmap Status row to Landed. One module ≈ one PR. The net-new counterpart to the `refactor` skill (which improves already-extracted components); stops when the roadmap queue is empty."
---

# Expanding the framework

`docs/expansion-roadmap.md` is the single source of truth for the **net-new
capability modules** this framework has planned — the surface it does not
cover yet, designed module by module so each lands as one reviewable PR. It
carries:

- the **standing rules** every entry must obey (they define what belongs in
  the framework at all);
- a **Status table** (module, subpath, size, priority, status);
- a **suggested phasing** ordering the PRs so shared infrastructure exists
  before its consumers;
- a **per-module design section** — pure core, components, seam, testing
  focus, and any decisions of record;
- a **Rejected / deferred** list with the reasoning, so settled questions
  don't get re-litigated.

This skill is the operating procedure for that file. Three modes:

- **Work mode** (the default — "expand the framework") — pick the next
  pending module, re-verify its design, implement it fully, update the
  roadmap.
- **Extend mode** — a capability gap was noticed that the roadmap doesn't
  carry: design it to the same depth as the existing entries (name, subpath,
  pure core sketch, seam, size, priority) and append it — don't implement in
  the same pass.
- **Status mode** — asked "where is the expansion at?": report the table,
  what landed most recently, and what's next; change nothing.

The skill is **grounded**: implement only modules with a roadmap section,
and never resurrect a **Rejected** entry without the user explicitly
overriding the recorded reasoning. When every row is Landed, say so and
stop — suggest running Extend mode or the `refactor` skill instead.

## Work mode — landing the next module

### 1. Pick

Read the roadmap. Take the highest-priority **Pending** row whose
prerequisites have landed (the phasing table encodes them — e.g. `format`
before `calendar`; the pointer-tracking util with `viewer` before `draw`).
The user can name a specific module to jump the queue; note the jump in the
roadmap when that happens.

### 2. Re-verify the design

The design sections were written against a snapshot of the tree, and the
tree drifts. Before writing code, check the section's assumptions:

- Do the framework pieces it composes still exist under the same names
  (`FloatingPanel`, `useGridRovingTabindex`, `Modal`, `useMeasuredSize`,
  `useSwipeDownToClose`, …)? Read their current props.
- Has some other module meanwhile absorbed part of the plan? Shrink the
  scope rather than duplicate.
- Does the demo still have the surface the showcase idea targets?

Material deviations from the design section get written back into it as
**decisions of record** when you land.

### 3. Implement — the standing rules are non-negotiable

- **Zero runtime dependencies.** Pure React + Web APIs. If the design seems
  to need a library, the design is wrong — go back to the roadmap.
- **No domain naming in `src/`** (AGENTS.md). Name the mechanism; the litmus
  test is whether an unrelated app could adopt the API without inheriting
  another app's vocabulary. Domain words live only in `demo/`.
- **Pure core + thin components.** DOM-free logic in its own files (like
  `checklist/tree.ts`, `charts/scale.ts`), components layered on top. The
  core is where the unit tests concentrate.
- **Theme tokens only** for styling (`--accent`/`--surface`/`--line`/… and
  the Tailwind utilities mapped to them); every visible string is a `labels`
  prop (or equivalent) with English defaults; no asset imports; files under
  1000 lines.
- **The wiring checklist**, all five places plus the paperwork:
  `src/<mod>/index.ts` barrel → re-export in `src/index.ts` → entry in
  `tsup.config.ts` → subpath in `package.json` `exports` → alias in
  `demo/vite.config.ts` — then tests in `tests/<name>.test.ts(x)`, a demo
  showcase under `demo/src/app/` (with `en`/`sv` i18n keys), a row in the
  README API table, and a `.changes/unreleased/` fragment (`type: Added`).

### 4. Verify

`make lint`, `make test`, `make build`, `make fmt-check` — all green, no
exceptions (AGENTS.md: any error a command surfaces is yours to fix). Then
prove the showcase in a real browser: start the demo dev server and drive it
with Playwright (see the AGENTS.md local-environment notes for the
pre-installed Chromium paths), exercising the new module's UI at least once.

### 5. Update the roadmap

In `docs/expansion-roadmap.md`:

- Flip the module's Status row to **Landed**.
- Fold any design deviations into its section as decisions of record —
  the section should describe what shipped, not what was once imagined.
- If implementation surfaced follow-up work (a deferred sub-feature, a new
  gap), append it as a Pending row or under Rejected/deferred with reasons.

Commit(s) follow Conventional Commits (`feat(<mod>): …`); the PR title is a
conventional-commit subject. One module per PR — resist bundling the next
"small" module into the same branch.

## Extend mode — growing the roadmap

Design the new entry to the same depth as its neighbours before it earns a
row: generic name + subpath, pure-core sketch, component/hook surface, the
app-side seam, accessibility/theming notes, a demo showcase idea, testing
focus, size, and priority relative to the existing queue. Check it against
the standing rules first — an entry that needs a runtime dep or a domain
name is rejected on arrival (record why). Append the row to the Status
table and the section to the body; leave Status = Pending.

## Boundaries

- **This skill adds new capability**; lifting more responsibility into
  already-shipped components is the `refactor` skill, and choosing what to
  mine from the donor apps is `find-refactor-candidates`. Route findings to
  the right queue rather than absorbing them here.
- The roadmap's **Rejected** entries are settled: form validation, the
  calculator keypad, full RRULE. Re-open one only on an explicit user
  instruction, and record the reversal in the file.
