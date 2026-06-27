---
type: Added
title: Type-ahead for SelectPicker
---

`hooks`: `useTypeahead` — list-box "type to select", where printable keystrokes jump to the first option whose label starts with what's been typed (resetting after a pause), plus the pure `matchPrefixRange` helper that locates the matched characters for highlighting. `components`: `SelectPicker` now wires this in — typing while the panel is open moves the highlight to the matching option and marks the match. On by default whenever an option exposes a string to match (its `label`, or a new per-option `typeaheadLabel` when the label is a React node); pass `typeahead={false}` to switch it off.
