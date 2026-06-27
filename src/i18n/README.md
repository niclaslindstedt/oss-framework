<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/i18n`

A tiny, dependency-free, **typed** translation runtime for a local-first PWA.
One React context carries the active language; one typed `t()` reads from your
per-language catalog modules; non-default languages are code-split and loaded on
demand. No third-party i18n library, no message-format DSL — just a typed
dotted-key lookup with `{name}`-style interpolation.

| Export                                                                      | What it is                                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `createI18n(config)`                                                        | Build a fully-typed i18n runtime over your catalogs. Returns the whole surface below.   |
| `detectBrowserLanguage`                                                     | First-run detection: prefix-match `navigator.language` against your supported langs.    |
| `formatMessage`                                                             | Interpolate `{name}` placeholders in a raw string (the runtime's own formatter).        |
| `flattenCatalog`                                                            | Flatten a nested catalog into a `dotted.path → string` map (used internally).           |
| `Widen<T>`                                                                  | Widen a `typeof en` literal object to plain `string` leaves so translations type-check. |
| `CatalogShape`, `Leaves`, `MessageKeyOf`, `TFunction`, `I18nConfig`, `I18n` | The types.                                                                              |

## What it owns vs. what stays in your app

**The framework owns the machinery; your app owns the strings.** Translation
tables diverge per app and per locale — they are not reusable — so this module
ships **no locale data**. You provide:

- your **language union** (`type Lang = "en" | "sv"`) and which one is the
  bundled fallback;
- your **catalogs** — one nested object of strings per language, the English
  (or whichever) one bundled and the rest behind dynamic-import loaders;
- optionally, the **BCP-47 mapping** and **detection** strategy.

The framework gives you back a typed runtime that loads, caches, resolves, and
re-renders against those catalogs — plus a `LanguageRoot` that mirrors the
preference to `localStorage`, gates the first paint so a returning non-default
user never sees a flash of the fallback language, and keeps `<html lang>` in
step.

All runtime state lives inside the closure of one `createI18n` call, so a test,
a preview, or a second mount can each hold an independent runtime without
sharing a catalog cache.

## The contract

- **`localStorage`** — `LanguageRoot` reads/writes a plaintext language code
  under `storageKey` (default `"oss.language"`). It is a UX mirror, not the
  source of truth; a quota/sandbox failure falls back to detection silently.
- **A window `CustomEvent`** — `writeLanguagePreference` / `setLanguage`
  dispatch `eventName` (default `"oss:language"`) with the new code in
  `detail`. `LanguageRoot` listens, loads the target catalog, then flips the
  context — so any control can switch language without importing the root.
- **`<html lang>`** — `LanguageRoot` sets it to `toBcp47(lang)` on every change.

## Quick start

Lay your catalogs out one nested object per language. Derive the `Catalog` type
from the bundled language with `Widen` so the others can supply different
strings:

```ts
// i18n/en.ts — the bundled catalog (also the MessageKey type source)
export const en = {
  common: { close: "Close", save: "Save" },
  nav: { home: "Home", settings: "Settings" },
} as const;

// i18n/sv.ts — code-split, loaded on demand
export const sv = {
  common: { close: "Stäng", save: "Spara" },
  nav: { home: "Hem", settings: "Inställningar" },
} as const;
```

```ts
// i18n/index.ts — build the runtime once and export its pieces
import { createI18n, type Widen } from "@niclaslindstedt/oss-framework/i18n";
import { en } from "./en.ts";

export type Lang = "en" | "sv";
export type Catalog = Widen<typeof en>;

export const i18n = createI18n<Lang, Catalog>({
  fallbackLang: "en",
  fallbackCatalog: en,
  loaders: { sv: () => import("./sv.ts").then((m) => m.sv) },
  toBcp47: (l) => (l === "sv" ? "sv-SE" : "en-GB"),
  storageKey: "myapp:language",
  eventName: "myapp:language",
});

export const { LanguageRoot, useT, useLang, setLanguage } = i18n;
```

Wrap your app once, then translate anywhere under it:

```tsx
// main.tsx
import { LanguageRoot } from "./i18n/index.ts";

createRoot(el).render(
  <LanguageRoot>
    <App />
  </LanguageRoot>,
);
```

```tsx
// any component
import { useT } from "./i18n/index.ts";

function CloseButton() {
  const t = useT();
  return <button>{t("common.close")}</button>; // "common.close" autocompletes
}
```

Switch language from a settings control — no prop drilling, no root import:

```tsx
import { setLanguage, useLang } from "./i18n/index.ts";

function LanguagePicker() {
  const lang = useLang();
  return (
    <select value={lang} onChange={(e) => setLanguage(e.target.value as Lang)}>
      <option value="en">English</option>
      <option value="sv">Svenska</option>
    </select>
  );
}
```

## API surface

`createI18n<Lang, Catalog>(config)` returns:

| Member                                                | Purpose                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `LanguageRoot`                                        | Top-level wrapper: preference mirror + first-paint gate + `<html lang>`.   |
| `LanguageProvider`                                    | Bare context provider (use `LanguageRoot` unless you drive lang yourself). |
| `useT()`                                              | The translate hook → `t(key, params?)`. `key` is typed to your catalog.    |
| `useLang()`                                           | The active language code.                                                  |
| `setLanguage(lang)` / `writeLanguagePreference(lang)` | Persist + broadcast a switch.                                              |
| `readLanguagePreference()`                            | The stored code, or a detected one on first run.                           |
| `ensureCatalog(lang)` / `isCatalogLoaded(lang)`       | Manually load / check a language's catalog.                                |
| `tFor(lang, key, params?)`                            | Standalone lookup for non-React code (pass the language explicitly).       |
| `supportedLangs`, `toBcp47`                           | The resolved language list and BCP-47 mapping.                             |

`config` fields: `fallbackLang`, `fallbackCatalog` (required); `loaders`,
`supportedLangs`, `toBcp47`, `detectLanguage`, `storageKey`, `eventName`
(optional — see `I18nConfig`).

**Missing keys never throw.** A key absent from the active catalog falls back to
the fallback catalog; absent from both, `t()` returns the key itself, so a typo
is visible rather than blank. A not-yet-loaded language resolves through the
fallback until `LanguageRoot` (or `ensureCatalog`) brings its catalog in.

## Adapting to your app

- **More languages.** Add the code to `Lang`, a catalog module, and one
  `loaders` entry. `supportedLangs` defaults to `fallbackLang` plus every
  `loaders` key, so adding a loader is enough; set `supportedLangs` explicitly
  only to order or restrict the offered set.
- **Regional tags / `Intl`.** Supply `toBcp47` to map `"sv" → "sv-SE"` etc.;
  the default returns the code unchanged, which is fine for region-free codes.
- **Custom detection.** Pass `detectLanguage(supported, fallback)` to override
  the `navigator.language` prefix match (e.g. read a server hint, an account
  preference, or always start at the fallback).
- **Your own storage / event keys.** Set `storageKey` and `eventName` to match
  your app's conventions; they default to `"oss.language"` / `"oss:language"`.
- **A non-React or worker context.** Use `tFor(lang, key, params)` — it shares
  the same catalog cache as the hooks but takes the language explicitly.
- **Catalogs that drift out of sync.** Derive every non-fallback catalog's type
  from `Catalog` (`const sv: Catalog = { … }`) so a missing or renamed key is a
  compile error, not a silent fallback at runtime.
- **You don't want the first-paint gate.** Mount `LanguageProvider` directly and
  drive `value` from your own state instead of `LanguageRoot`; you then own the
  `ensureCatalog` call and the `<html lang>` attribute.

## Verification

- A returning non-default user loads straight into their language with no flash
  of the fallback (the gate), and `document.documentElement.lang` matches.
- Switching language in the UI re-renders every `useT()` consumer and persists
  across reload.
- An unknown / not-yet-loaded key renders the fallback string (or the key), not
  a blank.
