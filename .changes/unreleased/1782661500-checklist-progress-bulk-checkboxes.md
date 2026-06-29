---
type: Changed
title: Checkbox glyph on the checklist bulk-action menu
---

The `ChecklistProgress` bulk-action menu now marks its "check all" / "uncheck
all" rows with a checkbox glyph — a filled (accent) box for check-all and an
empty (muted) box for uncheck-all — so the rows read as checklist items. The
drawn box is extracted as a new presentational `CheckboxGlyph` export (the same
mark the interactive `Checkbox` paints), available for any read-only checkbox cue.
