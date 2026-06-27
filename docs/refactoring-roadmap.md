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

_(none yet)_

### Severity 3–4

_(none yet)_

### Easy wins (mechanical, any severity)

_(none yet)_

## Landed

_(none yet)_

## Investigated and skipped

_(none yet)_
