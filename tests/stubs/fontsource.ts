// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Empty stand-in for the `@fontsource/*` CSS side-effect imports in
// `src/theme/fonts.ts`. The font packages are optional peer dependencies the
// consuming app supplies; they are not installed here, so the test config
// (see `vitest.config.ts`) aliases every `@fontsource/*` specifier to this
// no-op module. The loaders only care that the import resolves.
export {};
