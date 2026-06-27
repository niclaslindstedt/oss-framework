// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public surface of the i18n module: a dependency-free, typed `t()` runtime
// built per-app by `createI18n`. Your app owns its catalogs (the translation
// tables); the framework owns the machinery that loads, caches, and resolves
// them. See `src/i18n/README.md`.
export { createI18n } from "./createI18n.tsx";
export {
  detectBrowserLanguage,
  formatMessage,
  flattenCatalog,
} from "./locale.ts";
export type {
  CatalogShape,
  Leaves,
  MessageKeyOf,
  TFunction,
  Widen,
  I18nConfig,
  I18n,
} from "./types.ts";
