// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Ambient declaration for the side-effecting CSS imports the font loaders pull
// in (`@fontsource/inter/latin-400.css`, …). `@fontsource/*` is an optional
// peer dependency resolved by the consuming app's bundler, not by the
// framework's `tsc`, so the modules carry no types of their own — this lets
// `fonts.ts` typecheck without installing the font packages here.
declare module "*.css";
