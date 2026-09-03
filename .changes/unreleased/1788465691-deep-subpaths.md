---
type: Added
title: Per-component and per-hook subpaths
---

Every component and hook is now reachable as its own file — `.../components/Button`,
`.../hooks/useEscapeKey` — which matters for a CommonJS `require()` (106 kB for
the components barrel, 1.1 kB for one component) and for loading the package
over an import map.
