// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Types for the tiny typed-`t()` i18n runtime. The catalog shape, the
// dotted-path `MessageKey` derivation, and the factory's config / return
// surface all live here so a consuming app can name them without reaching
// into the runtime.

import type { ReactElement, ReactNode } from "react";

// A language catalog: a nested object whose leaves are strings. Your app's
// English catalog is the canonical shape — every other language must match
// it, and `MessageKey` is derived from it.
export interface CatalogShape {
  readonly [key: string]: string | CatalogShape;
}

// Dotted-path type derived from a catalog shape. Turns `{ a: { b: "x" } }`
// into the literal `"a.b"`, so `t("a.b")` autocompletes to every leaf and
// rejects typos at the call site.
export type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends object
      ? Leaves<T[K], `${P}${K}.`>
      : never;
}[keyof T & string];

// Every `MessageKey` for a catalog `C`.
export type MessageKeyOf<C> = Leaves<C>;

// The translate function: a typed key plus optional `{name}`-style params.
export type TFunction<C> = (
  key: Leaves<C>,
  params?: Record<string, string | number>,
) => string;

// Recursively widen every leaf from its literal type (`"Close"`) to plain
// `string`, so a non-English catalog can supply different strings while still
// satisfying the catalog type. Apply this to your `typeof en` so the
// `Catalog` type accepts translations.
export type Widen<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: Widen<T[K]> }
    : T;

// Configuration handed to `createI18n`. `Lang` is your app's language union
// (e.g. `"en" | "sv"`); `C` is your catalog shape (`typeof en`, widened).
export interface I18nConfig<Lang extends string, C extends CatalogShape> {
  // The language bundled synchronously — the default, the fallback for any
  // missing key, and the source of the `MessageKey` type.
  fallbackLang: Lang;
  // The bundled catalog for `fallbackLang`.
  fallbackCatalog: C;
  // Dynamic-import thunks for the non-fallback languages, so a language the
  // user never selects costs nothing at first paint. Omit a language to make
  // it fall back to `fallbackCatalog`.
  loaders?: Partial<Record<Lang, () => Promise<C>>>;
  // The languages your app offers. Defaults to `fallbackLang` plus every key
  // present in `loaders`.
  supportedLangs?: readonly Lang[];
  // Map a language code to a BCP-47 tag for `<html lang>` and `Intl`
  // formatters (e.g. `"sv" → "sv-SE"`). Defaults to the code itself.
  toBcp47?: (lang: Lang) => string;
  // First-run detection when no preference is stored. Defaults to a
  // `navigator.language` prefix match against `supportedLangs`.
  detectLanguage?: (supported: readonly Lang[], fallback: Lang) => Lang;
  // localStorage key for the plaintext preference mirror, so first paint
  // renders in the right language without reading the app's data store.
  storageKey?: string;
  // Window event broadcast on a runtime language switch; `LanguageRoot`
  // listens, loads the target catalog, then flips the context.
  eventName?: string;
}

// The runtime returned by `createI18n`, fully typed to your `Lang` / `C`.
export interface I18n<Lang extends string, C extends CatalogShape> {
  // Provides the active language to the tree. Usually you mount `LanguageRoot`
  // instead, which also drives the preference mirror and first-paint gate.
  LanguageProvider: (props: {
    value: Lang;
    children: ReactNode;
  }) => ReactElement;
  // Top-level wrapper: seeds the language from the stored preference, gates
  // the first paint until that catalog is resident (no flash of English),
  // keeps `<html lang>` in step, and applies runtime switches.
  LanguageRoot: (props: { children: ReactNode }) => ReactElement | null;
  // The translate hook — call inside a component under `LanguageRoot`.
  useT: () => TFunction<C>;
  // The active language code.
  useLang: () => Lang;
  // Load (and flatten) a language's catalog if it is not resident yet.
  // Resolves immediately for the fallback / already-loaded languages.
  ensureCatalog: (lang: Lang) => Promise<void>;
  // Whether a language's catalog is resident.
  isCatalogLoaded: (lang: Lang) => boolean;
  // Standalone lookup for non-React contexts. Pass the language explicitly.
  tFor: (
    lang: Lang,
    key: Leaves<C>,
    params?: Record<string, string | number>,
  ) => string;
  // Read the stored language preference (or detect one on first run).
  readLanguagePreference: () => Lang;
  // Persist a language preference and broadcast the switch event.
  writeLanguagePreference: (lang: Lang) => void;
  // Alias of `writeLanguagePreference` — the verb a settings UI reaches for.
  setLanguage: (lang: Lang) => void;
  // The resolved list of offered languages.
  supportedLangs: readonly Lang[];
  // The resolved language → BCP-47 mapping.
  toBcp47: (lang: Lang) => string;
}
