// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What one import is allowed to cost.
//
// The point of these numbers is not the numbers. It is the *property* they
// pin: importing one symbol pulls that symbol and its own dependencies, and
// nothing else in the library — from the package root exactly as from the
// module subpath. That property already holds; a budget is how it keeps
// holding through a refactor that quietly introduces a side effect, a barrel
// that imports for effect, or a bundler setting that stops splitting.
//
// Budgets are minified bytes with `react` / `react-dom` external, and are set
// roughly 40% above the measured cost, so a real regression trips them while
// ordinary drift does not. When a number moves for a good reason, move the
// budget in the same commit and say why in the message.
//
// A case with `cjs: true` is measured as `require()` instead. That path gets
// no tree-shaking at all — a CommonJS require of a barrel pulls every module
// behind it — which is exactly why the deep `./components/*` and `./hooks/*`
// subpaths exist, and why the pair of cases below is worth pinning.

/** @type {{name: string, code: string, budget: number}[]} */
export const CASES = [
  // A pure formatter: the floor. If this grows, something in `format` started
  // dragging its neighbours in.
  {
    name: "format/formatBytes",
    code: `import { formatBytes } from "@niclaslindstedt/oss-framework/format";\nconsole.log(formatBytes(1024));`,
    budget: 600,
  },
  // …and the same symbol through the root barrel. It must cost the same: the
  // barrel is a re-export map, not a bundle.
  {
    name: "root/formatBytes",
    code: `import { formatBytes } from "@niclaslindstedt/oss-framework";\nconsole.log(formatBytes(1024));`,
    budget: 600,
  },
  // One small component, and one glyph — the two things every adopter reaches
  // for first.
  {
    name: "components/Button",
    code: `import { Button } from "@niclaslindstedt/oss-framework/components";\nconsole.log(Button);`,
    budget: 1100,
  },
  {
    name: "root/Button",
    code: `import { Button } from "@niclaslindstedt/oss-framework";\nconsole.log(Button);`,
    budget: 1100,
  },
  {
    name: "components/CopyIcon",
    code: `import { CopyIcon } from "@niclaslindstedt/oss-framework/components";\nconsole.log(CopyIcon);`,
    budget: 900,
  },
  // A component with real machinery behind it (portal, focus trap, scroll
  // lock) — the ceiling for "one component".
  {
    name: "components/Modal",
    code: `import { Modal } from "@niclaslindstedt/oss-framework/components";\nconsole.log(Modal);`,
    budget: 6500,
  },
  // A pure core with no React in it at all: proof the components sharing a
  // module barrel stay out of a logic-only import.
  {
    name: "calendar/buildMonthGrid",
    code: `import { buildMonthGrid } from "@niclaslindstedt/oss-framework/calendar";\nconsole.log(buildMonthGrid(2026, 7, {}));`,
    budget: 2000,
  },
  {
    name: "search/compileQuery",
    code: `import { compileQuery } from "@niclaslindstedt/oss-framework/search";\nconsole.log(compileQuery("abc"));`,
    budget: 3300,
  },
  // The deep subpaths: one file, reachable directly. On the ESM side this is
  // no better than the barrel (tree-shaking already got there); on the CJS
  // side it is the whole difference between a component and a library.
  {
    name: "components/Button (deep)",
    code: `import { Button } from "@niclaslindstedt/oss-framework/components/Button";\nconsole.log(Button);`,
    budget: 1100,
  },
  {
    name: "hooks/useEscapeKey (deep)",
    code: `import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks/useEscapeKey";\nconsole.log(useEscapeKey);`,
    budget: 900,
  },
  {
    name: "components/Button (require)",
    code: `const { Button } = require("@niclaslindstedt/oss-framework/components/Button");\nconsole.log(Button);`,
    cjs: true,
    budget: 1600,
  },
  {
    name: "storage/backoffDelayMs",
    code: `import { backoffDelayMs } from "@niclaslindstedt/oss-framework/storage";\nconsole.log(backoffDelayMs(1));`,
    budget: 900,
  },
];
