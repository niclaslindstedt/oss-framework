// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Ambient declaration for the side-effecting CSS imports `fontsource.ts` pulls
// in (`@fontsource/inter/latin-400.css`, …). `@fontsource/*` is an optional
// peer dependency resolved by the consuming app's bundler, not by the
// framework's `tsc`, so the modules carry no types of their own — this lets
// that module typecheck without installing the font packages here.
//
// Kept under a name that is not any module's own basename: a `foo.d.ts` beside
// a `foo.ts` is read as *that module's* declarations rather than as an ambient
// block, which silently switches this file off.
declare module "*.css";
